import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  useWindowDimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as ScreenCapture from 'expo-screen-capture';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000/api/v1';
const ACCESS_KEY = 'chatika_mobile_access';
const REFRESH_KEY = 'chatika_mobile_refresh';
const PUSH_PERMISSION_KEY = 'chatika_mobile_push_permission';

function readingPositionKey(userId, roomId) {
  return `chatika_mobile_reading_position:${userId}:${roomId}`;
}

function formatLastSeen(value) {
  if (!value) return 'Last seen unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last seen unavailable';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Last seen just now';
  if (elapsedMinutes < 60) return `Last seen ${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1440) return `Last seen ${Math.floor(elapsedMinutes / 60)}h ago`;
  return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

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
    const requestError = new Error(json.detail || `Request failed (${res.status})`);
    requestError.status = res.status;
    throw requestError;
  }
  return json;
}

export default function App() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '',
    password: '',
    device_name: `${Platform.OS} · Chatika app`,
    locale: Intl.DateTimeFormat().resolvedOptions().locale || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  });
  const [error, setError] = useState('');

  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [me, setMe] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, favorite_feature: 'messaging', improvement_area: 'reliability', comment: '' });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [contactUsername, setContactUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupUsers, setGroupUsers] = useState('');
  const [groupComposerOpen, setGroupComposerOpen] = useState(false);
  const [discoverScope, setDiscoverScope] = useState('online');
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const messageListRef = useRef(null);
  const restoredPositionsRef = useRef(new Set());
  const refreshPromiseRef = useRef(null);
  const { width } = useWindowDimensions();
  const compact = width < 380;

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('chatika-private-content').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('chatika-private-content').catch(() => {});
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const storedToken = (await AsyncStorage.getItem(ACCESS_KEY)) || '';
        const storedRefreshToken = (await AsyncStorage.getItem(REFRESH_KEY)) || '';
        if (!active) return;
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
      } catch {
        if (active) {
          setToken('');
          setRefreshToken('');
        }
      } finally {
        if (active) setStorageReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(ACCESS_KEY, token || '');
    AsyncStorage.setItem(REFRESH_KEY, refreshToken || '');
  }, [token, refreshToken]);

  useEffect(() => {
    if (__DEV__) return;

    Updates.checkForUpdateAsync()
      .then(async (result) => {
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      })
      .catch(() => undefined);
  }, []);

  async function hydrate(currentToken) {
    const meData = await api('/auth/me', { token: currentToken });
    setMe(meData);

    const roomData = await api('/chat/rooms', { token: currentToken });
    setRooms(roomData);
    setActiveRoomId('');
    setMessages([]);
  }

  async function tryRefresh() {
    if (!refreshToken) return false;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    refreshPromiseRef.current = (async () => {
      try {
        const pair = await api('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: refreshToken }
        });
        setToken(pair.access_token);
        setRefreshToken(pair.refresh_token);
        await hydrate(pair.access_token);
        return true;
      } catch (refreshError) {
        if (refreshError.status === 401 || refreshError.status === 403) {
          setToken('');
          setRefreshToken('');
          setMe(null);
          return false;
        }
        throw refreshError;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }

  useEffect(() => {
    let active = true;
    let retryTimer;
    if (!storageReady) return () => { active = false; };
    if (!token) {
      if (refreshToken) {
        setSessionReady(false);
        tryRefresh()
          .then((restored) => {
            if (active && !restored) setSessionReady(true);
          })
          .catch(() => {
            if (active) retryTimer = setTimeout(() => setSessionRetry((value) => value + 1), 2200);
          });
        return () => {
          active = false;
          clearTimeout(retryTimer);
        };
      }
      setSessionReady(true);
      return () => { active = false; };
    }
    setSessionReady(false);
    (async () => {
      try {
        await hydrate(token);
        if (active) setSessionReady(true);
      } catch (sessionError) {
        try {
          const restored = sessionError.status === 401 || sessionError.status === 403
            ? await tryRefresh()
            : false;
          if (active && (restored || sessionError.status === 401 || sessionError.status === 403)) {
            setSessionReady(true);
          } else if (active) {
            retryTimer = setTimeout(() => setSessionRetry((value) => value + 1), 2200);
          }
        } catch {
          if (active) retryTimer = setTimeout(() => setSessionRetry((value) => value + 1), 2200);
        }
      }
    })();
    return () => {
      active = false;
      clearTimeout(retryTimer);
    };
  }, [storageReady, token, refreshToken, sessionRetry]);

  useEffect(() => {
    if (!token || !Device.isDevice) return;
    registerPushToken(token).catch(() => undefined);
  }, [token]);

  async function registerPushToken(currentToken) {
    const permissions = await Notifications.getPermissionsAsync();
    let permission = permissions.status;
    const storedPermission = await AsyncStorage.getItem(PUSH_PERMISSION_KEY);
    if (permission !== 'granted' && !storedPermission) {
      permission = (await Notifications.requestPermissionsAsync()).status;
      await AsyncStorage.setItem(PUSH_PERMISSION_KEY, permission);
    }
    if (permission !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    const pushToken = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('/push/register-token', {
      method: 'POST',
      token: currentToken,
      body: {
        platform: Platform.OS,
        token: pushToken.data,
        device_name: `${Platform.OS} · Chatika app`
      }
    });
  }

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

  useEffect(() => {
    if (!me?.id || !activeRoomId || !messageListRef.current) return;
    const key = readingPositionKey(me.id, activeRoomId);
    if (restoredPositionsRef.current.has(key)) return;

    AsyncStorage.getItem(key).then((savedPositionValue) => {
      const savedPosition = Number(savedPositionValue);
      messageListRef.current?.scrollToOffset({
        offset: Number.isFinite(savedPosition) ? savedPosition : 0,
        animated: false
      });
      restoredPositionsRef.current.add(key);
    });
  }, [me?.id, activeRoomId, messages.length]);

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

  async function startDirectChat(selectedUsername = '') {
    const username = String(selectedUsername || contactUsername).trim();
    if (!username) return;
    try {
      const room = await api('/chat/direct', {
        method: 'POST',
        token,
        body: { username }
      });
      setRooms((prev) => [room, ...prev]);
      setActiveRoomId(room.id);
      setContactUsername('');
      setDiscoverUsers((users) => users.filter((user) => user.username !== username));
    } catch (e) {
      setError(e.message);
    }
  }

  async function discoverFriends(scope) {
    setDiscoverScope(scope);
    setDiscoverLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: contactUsername.trim(), scope });
      setDiscoverUsers(await api(`/chat/discover?${params.toString()}`, { token }));
    } catch (discoverError) {
      setError(discoverError.message);
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function createGroup() {
    const usernames = groupUsers.split(',').map((value) => value.trim()).filter(Boolean);
    if (!groupName.trim() || !usernames.length) return;
    try {
      const room = await api('/chat/groups', {
        method: 'POST',
        token,
        body: { name: groupName.trim(), usernames }
      });
      setRooms((prev) => [room, ...prev]);
      setActiveRoomId(room.id);
      setGroupName('');
      setGroupUsers('');
      setGroupComposerOpen(false);
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

  async function logout() {
    try {
      if (refreshToken) await api('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } });
    } catch (_error) {
      // Clear local session even when the network is unavailable.
    } finally {
      setToken('');
      setRefreshToken('');
      setMe(null);
      setRooms([]);
      setMessages([]);
    }
  }

  async function submitBetaFeedback() {
    if (!feedbackForm.rating || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await api('/feedback/beta', {
        method: 'POST',
        token,
        body: {
          ...feedbackForm,
          comment: feedbackForm.comment.trim() || null,
          app_version: Constants.expoConfig?.version || '0.4.11',
          platform: Platform.OS
        }
      });
      setMe((current) => current ? { ...current, needs_beta_feedback: false } : current);
    } catch (submitError) {
      setFeedbackError(submitError.message);
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);
  const activeOther = useMemo(
    () => activeRoom?.participants?.find((participant) => participant.id !== me?.id),
    [activeRoom, me?.id]
  );
  const activePresenceText = activeOther
    ? (activeOther.is_online ? `@${activeOther.username} · Online now` : `@${activeOther.username} · ${formatLastSeen(activeOther.last_seen_at)}`)
    : 'Private room';

  function saveReadingPosition(event) {
    if (!me?.id || !activeRoomId) return;
    AsyncStorage.setItem(
      readingPositionKey(me.id, activeRoomId),
      String(event.nativeEvent.contentOffset.y)
    );
  }

  if (!sessionReady) {
    return (
      <SafeAreaView style={styles.startupWrap}>
        <StatusBar style="light" />
        <Image source={require('./assets/icon.png')} style={styles.startupLogo} />
        <Text style={styles.startupTitle}>Chatika</Text>
        <Text style={styles.startupText}>Opening your conversations…</Text>
      </SafeAreaView>
    );
  }

  if (!me) {
    return (
      <SafeAreaView style={styles.authWrap}>
        <StatusBar style="light" translucent />
        <KeyboardAvoidingView style={styles.authKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.authScroll, compact && styles.authScrollCompact]} keyboardShouldPersistTaps="handled">
            <View style={styles.mobileBrandRow}>
              <Image source={require('./assets/icon.png')} style={styles.mobileLogo} />
              <View><Text style={styles.brand}>Chatika</Text><Text style={styles.brandTag}>Private communication, refined</Text></View>
            </View>
            <View style={styles.authCard}>
              <Text style={styles.eyebrow}>YOUR PEOPLE, IN ONE PLACE</Text>
              <Text style={styles.authTitle}>{mode === 'login' ? 'Welcome back.' : 'Make space for better conversations.'}</Text>
              <Text style={styles.subtitle}>Fast, private messaging that feels clear on every screen.</Text>
              <View style={styles.modeSwitch}>
                <TouchableOpacity onPress={() => setMode('login')} style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Login</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('register')} style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Register</Text></TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#7890a0" autoCapitalize="none" autoCorrect={false} value={form.username} onChangeText={(v) => setForm((f) => ({ ...f, username: v }))} />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#7890a0" secureTextEntry value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity onPress={submitAuth} style={styles.cta}><Text style={styles.ctaText}>{mode === 'login' ? 'Continue to Chatika  →' : 'Create my account  →'}</Text></TouchableOpacity>
            </View>
            <Text style={styles.switchMode}>{mode === 'login' ? 'Need an account? ' : 'Have an account? '}<Text style={styles.switchLink} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Register' : 'Login'}</Text></Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appWrap}>
      <StatusBar style="light" translucent />
      <View style={styles.header}>
        <View style={styles.headerIdentity}><Image source={require('./assets/icon.png')} style={styles.headerLogo} /><View><Text style={styles.brandMini}>@{me.username}</Text><Text style={styles.onlineText}>● Online now</Text></View></View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setGroupComposerOpen((value) => !value)} style={styles.newRoomBtn}><Text style={styles.newRoomTxt}>+ Group</Text></TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}><Text style={styles.logoutTxt}>Log out</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.directChatRow}>
        <TextInput style={styles.directChatInput} value={contactUsername} placeholder="Add @username" placeholderTextColor="#8ea0be" autoCapitalize="none" onChangeText={setContactUsername} />
        <TouchableOpacity onPress={() => startDirectChat()} style={styles.directChatButton}><Text style={styles.directChatButtonText}>Chat</Text></TouchableOpacity>
      </View>
      <View style={styles.discoveryRow}>
        <TouchableOpacity onPress={() => discoverFriends('online')} style={[styles.discoveryButton, discoverScope === 'online' && styles.discoveryButtonActive]}><Text style={styles.discoveryButtonText}>Online</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => discoverFriends('nearby')} style={[styles.discoveryButton, discoverScope === 'nearby' && styles.discoveryButtonActive]}><Text style={styles.discoveryButtonText}>Nearby</Text></TouchableOpacity>
        {discoverLoading ? <Text style={styles.discoveryLoading}>Finding…</Text> : null}
      </View>
      {discoverUsers.length ? <FlatList horizontal data={discoverUsers} keyExtractor={(item) => item.id} style={styles.discoveryList} renderItem={({ item }) => <TouchableOpacity onPress={() => startDirectChat(item.username)} style={styles.discoveryPerson}><Text style={styles.discoveryPersonName}>@{item.username}</Text><Text style={styles.discoveryPersonStatus}>{item.is_online ? 'Online now' : item.is_nearby ? 'Nearby' : formatLastSeen(item.last_seen_at)}</Text></TouchableOpacity>} /> : null}
      {groupComposerOpen && <View style={styles.groupComposer}><TextInput style={styles.directChatInput} value={groupName} placeholder="Group name" placeholderTextColor="#8ea0be" onChangeText={setGroupName} /><TextInput style={styles.directChatInput} value={groupUsers} placeholder="@friend1, @friend2" placeholderTextColor="#8ea0be" autoCapitalize="none" onChangeText={setGroupUsers} /><TouchableOpacity onPress={createGroup} style={styles.directChatButton}><Text style={styles.directChatButtonText}>Create group</Text></TouchableOpacity></View>}

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
      <Text style={styles.roomPresence}>{activePresenceText}</Text>

      <FlatList
        ref={messageListRef}
        style={styles.messageList}
        data={messages}
        inverted
        onScrollEndDrag={saveReadingPosition}
        onMomentumScrollEnd={saveReadingPosition}
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
      <Modal visible={Boolean(me.needs_beta_feedback)} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.feedbackBackdrop}>
          <ScrollView contentContainerStyle={styles.feedbackModal} keyboardShouldPersistTaps="handled">
            <Text style={styles.feedbackBeta}>BETA FEEDBACK</Text>
            <Text style={styles.feedbackTitle}>Help shape Chatika</Text>
            <Text style={styles.feedbackIntro}>Three quick answers. You will only see this once.</Text>
            <Text style={styles.feedbackLabel}>How is your first experience?</Text>
            <View style={styles.feedbackOptions}>
              {[1, 2, 3, 4, 5].map((rating) => <TouchableOpacity key={rating} onPress={() => setFeedbackForm((current) => ({ ...current, rating }))} style={[styles.feedbackChoice, feedbackForm.rating === rating && styles.feedbackChoiceActive]}><Text style={styles.feedbackChoiceText}>{rating}</Text></TouchableOpacity>)}
            </View>
            <Text style={styles.feedbackLabel}>What do you like most?</Text>
            <View style={styles.feedbackWrapOptions}>
              {[['messaging', 'Messaging'], ['calls', 'Calls'], ['media', 'Media'], ['design', 'Design'], ['speed', 'Speed']].map(([value, label]) => <TouchableOpacity key={value} onPress={() => setFeedbackForm((current) => ({ ...current, favorite_feature: value }))} style={[styles.feedbackPill, feedbackForm.favorite_feature === value && styles.feedbackPillActive]}><Text style={styles.feedbackPillText}>{label}</Text></TouchableOpacity>)}
            </View>
            <Text style={styles.feedbackLabel}>What should we improve first?</Text>
            <View style={styles.feedbackWrapOptions}>
              {[['reliability', 'Reliability'], ['calls', 'Calls'], ['mobile_ui', 'Mobile layout'], ['notifications', 'Notifications'], ['other', 'Other']].map(([value, label]) => <TouchableOpacity key={value} onPress={() => setFeedbackForm((current) => ({ ...current, improvement_area: value }))} style={[styles.feedbackPill, feedbackForm.improvement_area === value && styles.feedbackPillActive]}><Text style={styles.feedbackPillText}>{label}</Text></TouchableOpacity>)}
            </View>
            <TextInput style={styles.feedbackComment} value={feedbackForm.comment} onChangeText={(comment) => setFeedbackForm((current) => ({ ...current, comment }))} placeholder="Anything else? (optional)" placeholderTextColor="#718591" maxLength={500} multiline />
            {feedbackError ? <Text style={styles.error}>{feedbackError}</Text> : null}
            <TouchableOpacity disabled={!feedbackForm.rating || feedbackSubmitting} onPress={submitBetaFeedback} style={[styles.feedbackSubmit, (!feedbackForm.rating || feedbackSubmitting) && styles.feedbackSubmitDisabled]}><Text style={styles.feedbackSubmitText}>{feedbackSubmitting ? 'Sending…' : 'Send feedback'}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      <Text style={styles.mobileCredit}>Built with care by Piraticy · v0.4.11</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  startupWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a1221'
  },
  startupLogo: { width: 82, height: 82, borderRadius: 24, marginBottom: 14 },
  startupTitle: { color: '#f7fbff', fontSize: 25, fontWeight: '800' },
  startupText: { color: '#9cb1bd', fontSize: 12, marginTop: 6 },
  authWrap: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#0a1221'
  },
  authKeyboard: { flex: 1 },
  authScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  authScrollCompact: { paddingVertical: 18 },
  mobileBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 11 },
  mobileLogo: { width: 48, height: 48, borderRadius: 14 },
  brandTag: { color: '#6dffb0', fontSize: 11, marginTop: 2 },
  authCard: { borderRadius: 24, padding: 20, backgroundColor: '#f7fbff' },
  eyebrow: { color: '#5f7787', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  authTitle: { color: '#0a1221', fontSize: 32, lineHeight: 35, fontWeight: '800', marginBottom: 10 },
  modeSwitch: { flexDirection: 'row', gap: 5, padding: 5, marginBottom: 18, borderRadius: 12, backgroundColor: '#eaf2f7' },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  modeButtonActive: { backgroundColor: '#fff' },
  modeText: { color: '#718591', fontWeight: '700' },
  modeTextActive: { color: '#0a1221' },
  brand: {
    color: '#f7fbff',
    fontSize: 24,
    fontWeight: '800'
  },
  subtitle: {
    color: '#718591',
    lineHeight: 20,
    marginBottom: 18
  },
  input: {
    backgroundColor: '#fff',
    color: '#0a1221',
    borderWidth: 1,
    borderColor: '#d9e4ea',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10
  },
  cta: {
    backgroundColor: '#0a1221',
    borderRadius: 11,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4
  },
  ctaText: {
    color: '#f7fbff',
    fontWeight: '800'
  },
  switchMode: {
    color: '#9cb1bd',
    textAlign: 'center',
    marginTop: 14
  },
  switchLink: { color: '#00c4d4', fontWeight: '800' },
  error: {
    color: '#ff7a59',
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
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerLogo: { width: 36, height: 36, borderRadius: 11 },
  brandMini: {
    color: '#f7fbff',
    fontSize: 20,
    fontWeight: '700'
  },
  onlineText: { color: '#6dffb0', fontSize: 10, marginTop: 2 },
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
  logoutBtn: { borderWidth: 1, borderColor: '#31455b', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  logoutTxt: { color: '#ff9c82', fontSize: 11, fontWeight: '800' },
  directChatRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  directChatInput: { flex: 1, borderWidth: 1, borderColor: '#31455b', borderRadius: 10, color: '#f7fbff', paddingHorizontal: 11, paddingVertical: 9 },
  directChatButton: { borderRadius: 10, backgroundColor: '#00f0ff', justifyContent: 'center', paddingHorizontal: 13 },
  directChatButtonText: { color: '#0a1221', fontWeight: '800', fontSize: 12 },
  discoveryRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  discoveryButton: { borderWidth: 1, borderColor: '#31455b', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  discoveryButtonActive: { borderColor: '#00f0ff', backgroundColor: '#11354a' },
  discoveryButtonText: { color: '#e9f0ff', fontSize: 11, fontWeight: '800' },
  discoveryLoading: { color: '#9cb1bd', fontSize: 11 },
  discoveryList: { maxHeight: 58, marginBottom: 8 },
  discoveryPerson: { minWidth: 116, borderWidth: 1, borderColor: '#31455b', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, marginRight: 7, backgroundColor: '#122038' },
  discoveryPersonName: { color: '#f7fbff', fontWeight: '800', fontSize: 12 },
  discoveryPersonStatus: { color: '#6dffb0', fontSize: 10, marginTop: 2 },
  groupComposer: { gap: 7, marginBottom: 10 },
  roomPill: {
    backgroundColor: '#122038',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8
  },
  roomPillActive: {
    backgroundColor: '#00a8ff'
  },
  roomText: {
    color: '#e9f0ff'
  },
  roomTitle: {
    color: '#9cb1bd',
    marginTop: 10,
    marginBottom: 2
  },
  roomPresence: { color: '#6dffb0', fontSize: 12, marginBottom: 8 },
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
    backgroundColor: '#164456'
  },
  msgOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#122038'
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
    color: '#0a1221',
    fontWeight: '700'
  },
  feedbackBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(3,10,20,.72)' },
  feedbackModal: { borderRadius: 24, padding: 20, backgroundColor: '#f7fbff' },
  feedbackBeta: { color: '#0798a4', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  feedbackTitle: { color: '#0a1221', fontSize: 27, fontWeight: '800', marginTop: 7 },
  feedbackIntro: { color: '#718591', fontSize: 13, marginTop: 4, marginBottom: 18 },
  feedbackLabel: { color: '#294254', fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 8 },
  feedbackOptions: { flexDirection: 'row', gap: 7 },
  feedbackChoice: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#d9e4ea', borderRadius: 11, paddingVertical: 11, backgroundColor: '#fff' },
  feedbackChoiceActive: { borderColor: '#14d2e2', backgroundColor: '#dffbfc' },
  feedbackChoiceText: { color: '#0a1221', fontWeight: '800' },
  feedbackWrapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  feedbackPill: { borderWidth: 1, borderColor: '#d9e4ea', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  feedbackPillActive: { borderColor: '#14d2e2', backgroundColor: '#dffbfc' },
  feedbackPillText: { color: '#294254', fontSize: 12, fontWeight: '700' },
  feedbackComment: { minHeight: 74, marginTop: 16, borderWidth: 1, borderColor: '#d9e4ea', borderRadius: 12, padding: 12, color: '#0a1221', backgroundColor: '#fff', textAlignVertical: 'top' },
  feedbackSubmit: { alignItems: 'center', borderRadius: 13, paddingVertical: 14, marginTop: 14, backgroundColor: '#0a1221' },
  feedbackSubmitDisabled: { opacity: .45 },
  feedbackSubmitText: { color: '#fff', fontWeight: '800' },
  mobileCredit: { color: '#718591', textAlign: 'center', fontSize: 10, marginTop: 8, marginBottom: 2 }
});
