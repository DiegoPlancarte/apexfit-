import { useComponentLogic } from './hooks';

/**
 * CountdownOverlay Component
 * 3-second animated full-screen overlay triggered when starting a workout session.
 * Features audio beeps each second using the Web Audio API and haptic cues.
 */
export default function CountdownOverlay(props) {
  const { isActive } = props;
  const { count, displayText, handleCancel } = useComponentLogic(props);

  if (!isActive) return null;

  const isGo = count === 0;

  return (
    <div
      className="countdown-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Workout starting countdown"
    >
      <div className="countdown-content">
        <p className="countdown-subtitle">
          {isGo ? 'LIFT HEAVY' : 'GET READY'}
        </p>

        <div className={`countdown-circle ${isGo ? 'countdown-circle-go' : ''}`}>
          <span key={displayText} className="countdown-number">
            {displayText}
          </span>
        </div>

        {handleCancel && !isGo && (
          <button
            type="button"
            className="countdown-cancel-btn"
            onClick={handleCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
