interface ConfirmModalProps {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ isOpen, message, onConfirm, onCancel }: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h4>Potvrzení akce</h4>
                <p>{message}</p>
                <div className="modal-actions">
                    <button 
                        className="btn btn-secondary" 
                        onClick={onCancel}
                    >
                        Zrušit
                    </button>
                    <button 
                        className="btn btn-danger" 
                        onClick={onConfirm}
                    >
                        Potvrdit
                    </button>
                </div>
            </div>
        </div>
    );
}

