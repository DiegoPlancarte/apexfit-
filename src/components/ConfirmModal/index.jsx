import { useComponentLogic } from './hooks';

/**
 * ConfirmModal Component
 * Reusable mobile-optimized confirmation dialog for destructive or resetting actions.
 */
export default function ConfirmModal(props) {
  const {
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'danger',
    onConfirm,
    onCancel,
  } = props;

  const { handleBackdropClick } = useComponentLogic(props);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-dialog">
        <h3 id="modal-title" className="modal-title">
          {title}
        </h3>
        <p className="modal-message">{message}</p>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`modal-btn ${
              confirmVariant === 'danger' ? 'modal-btn-danger' : 'modal-btn-primary'
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
