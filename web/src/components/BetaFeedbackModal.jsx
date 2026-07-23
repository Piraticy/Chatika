import React, { useState } from 'react';

const FAVORITES = [
  ['messaging', 'Messaging'],
  ['calls', 'Calls'],
  ['media', 'Photos & voice'],
  ['design', 'Design'],
  ['speed', 'Speed']
];

const IMPROVEMENTS = [
  ['reliability', 'Reliability'],
  ['calls', 'Calls'],
  ['mobile_ui', 'Mobile layout'],
  ['notifications', 'Notifications'],
  ['other', 'Something else']
];

export default function BetaFeedbackModal({ open, submitting, error, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [favoriteFeature, setFavoriteFeature] = useState('messaging');
  const [improvementArea, setImprovementArea] = useState('reliability');
  const [comment, setComment] = useState('');

  if (!open) return null;

  function submit(event) {
    event.preventDefault();
    if (!rating || submitting) return;
    onSubmit({ rating, favorite_feature: favoriteFeature, improvement_area: improvementArea, comment });
  }

  return (
    <div className="modal-backdrop feedback-backdrop">
      <form className="feedback-modal" onSubmit={submit} aria-labelledby="feedback-title">
        <span className="feedback-beta">BETA FEEDBACK</span>
        <h2 id="feedback-title">Help shape Chatika</h2>
        <p>Three quick answers. You will only see this once.</p>

        <fieldset>
          <legend>How is your first experience?</legend>
          <div className="rating-row" aria-label="Rate your experience from one to five">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" className={rating === value ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} out of 5`}>{value}</button>
            ))}
          </div>
        </fieldset>

        <label>What do you like most?
          <select value={favoriteFeature} onChange={(event) => setFavoriteFeature(event.target.value)}>
            {FAVORITES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label>What should we improve first?
          <select value={improvementArea} onChange={(event) => setImprovementArea(event.target.value)}>
            {IMPROVEMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label>Anything else? <small>Optional</small>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="A short note for the Chatika team" />
        </label>

        {error && <div className="notice-card error-card">{error}</div>}
        <button className="feedback-submit" type="submit" disabled={!rating || submitting}>{submitting ? 'Sending…' : 'Send feedback'}</button>
      </form>
    </div>
  );
}
