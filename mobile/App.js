import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000/api/v1';
const ACCESS_KEY = 'chatika_mobile_access';
const REFRESH_KEY = 'chatika_mobile_refresh';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.detail || `Request failed (${res.status})`);
  }
  return json;
}

export default function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', phone_number: '', password: '', device_name: 'Mobile Device' });
  const [error, setError] = useState('');

  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [me, setMe] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    (async () => {
      const t = (await AsyncStorage.getItem(ACCESS_KEY)) || '';
      const r = (await AsyncStorage.getItem(REFRESH_KEY)) || '';
      setToken(t);
      setRefreshToken(r);
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(ACCESS_KEY, token || '');
    AsyncStorage.setItem(REFRESH_KEY, refreshToken || '');
  }, [token, refreshToken]);

  async function hydrate(currentToken) {
    const meData = await api('/auth/me', { token: currentToken });
    setMe(meData);

    const roomData = await api('/chat/rooms', { token: currentToken });
    setRooms(roomData);
    if (!activeRoomId && roomData[0]) setActiveRoomId(roomData[0].id);
  }

  async function tryRefresh() {
    if (!refreshToken) return;
    try {
      const pair = await api('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken }
      });
      setToken(pair.access_token);
      setRefreshToken(pair.refresh_token);
      await hydrate(pair.access_token);
    } catch (_e) {
      setToken('');
      setRefreshToken('');
      setMe(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    hydrate(token).catch(() => tryRefresh());
  }, [token]);

  useEffect(() => {
    if (!token || !activeRoomId) return;

    api(`/chat/rooms/${activeRoomId}/messages`, { token }).then(setMessages).catch(() => setMessages([]));

    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '/api/v1/realtime/ws');
    const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

    socket.onmessage = (event) => {
      try {
        const evt = JSON.parse(event.data);
        if (evt.event === 'message:new' && evt.data.room_id === activeRoomId) {
          setMessages((prev) => [evt.data, ...prev]);
        }
      } catch (_e) {
        // ignore non-json messages
      }
    };

    return () => socket.close();
  }, [token, activeRoomId]);

  async function submitAuth() {
    setError('');
    try {
      const pair = await api(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: form
      });
      setToken(pair.access_token);
      setRefreshToken(pair.refresh_token);
      await hydrate(pair.access_token);
    } catch (e) {
      setError(e.message);
    }
  }

  async function createRoom() {
    try {
      const room = await api('/chat/rooms', {
        method: 'POST',
        token,
        body: { name: 'New Mobile Room', participant_ids: [] }
      });
      setRooms((prev) => [room, ...prev]);
      setActiveRoomId(room.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !activeRoomId) return;

    await api('/chat/messages', {
      method: 'POST',
      token,
      body: { room_id: activeRoomId, text, message_type: 'text' }
    });
    setDraft('');
  }

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);

  if (!me) {
    return (
      <SafeAreaView style={styles.authWrap}>
        <StatusBar style="light" translucent />
        <Text style={styles.brand}>Chatika</Text>
        <Text style={styles.subtitle}>Secure cross-device messaging</Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#8ea0be"
            value={form.username}
            onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#8ea0be"
          value={form.phone_number}
          onChangeText={(v) => setForm((f) => ({ ...f, phone_number: v }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8ea0be"
          secureTextEntry
          value={form.password}
          onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={submitAuth} style={styles.cta}>
          <Text style={styles.ctaText}>{mode === 'login' ? 'Login' : 'Register'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={styles.switchMode}>{mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appWrap}>
      <StatusBar style="light" translucent />
      <View style={styles.header}>
        <Text style={styles.brandMini}>@{me.username}</Text>
        <TouchableOpacity onPress={createRoom} style={styles.newRoomBtn}>
          <Text style={styles.newRoomTxt}>+ Room</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setActiveRoomId(item.id)}
            style={[styles.roomPill, item.id === activeRoomId && styles.roomPillActive]}
          >
            <Text style={styles.roomText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.roomTitle}>{activeRoom ? activeRoom.name : 'No room selected'}</Text>

      <FlatList
        style={styles.messageList}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.msg, item.sender_id === me.id ? styles.msgMine : styles.msgOther]}>
            <Text style={styles.msgText}>{item.text || `[${item.message_type}]`}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          placeholder="Type message"
          placeholderTextColor="#8ea0be"
          onChangeText={setDraft}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={styles.sendTxt}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authWrap: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#0a1221'
  },
  brand: {
    color: '#f7fbff',
    fontSize: 38,
    fontWeight: '700'
  },
  subtitle: {
    color: '#8ea0be',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#122038',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10
  },
  cta: {
    backgroundColor: '#00f0ff',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4
  },
  ctaText: {
    color: '#072133',
    fontWeight: '700'
  },
  switchMode: {
    color: '#8ea0be',
    textAlign: 'center',
    marginTop: 14
  },
  error: {
    color: '#ff7786',
    marginBottom: 8
  },
  appWrap: {
    flex: 1,
    padding: 12,
    backgroundColor: '#0a1221'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  brandMini: {
    color: '#f7fbff',
    fontSize: 20,
    fontWeight: '700'
  },
  newRoomBtn: {
    backgroundColor: '#ff7a59',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  newRoomTxt: {
    color: '#130f1f',
    fontWeight: '700'
  },
  roomPill: {
    backgroundColor: '#122038',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8
  },
  roomPillActive: {
    backgroundColor: '#1d385c'
  },
  roomText: {
    color: '#e9f0ff'
  },
  roomTitle: {
    color: '#8ea0be',
    marginTop: 10,
    marginBottom: 8
  },
  messageList: {
    flex: 1
  },
  msg: {
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: '80%'
  },
  msgMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#153748'
  },
  msgOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#13233e'
  },
  msgText: {
    color: '#f7fbff'
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#122038',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sendBtn: {
    backgroundColor: '#00f0ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  sendTxt: {
    color: '#072133',
    fontWeight: '700'
  }
});
