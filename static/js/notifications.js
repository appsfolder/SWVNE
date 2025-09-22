// Custom Modal and Notification System
class NotificationSystem {
    constructor() {
        this.createToastContainer();
        this.toastId = 0;
    }

    // Create toast container if it doesn't exist
    createToastContainer() {
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    // Show success toast
    success(title, message = '', duration = 5000) {
        this.showToast('success', title, message, duration);
    }

    // Show error toast
    error(title, message = '', duration = 7000) {
        this.showToast('error', title, message, duration);
    }

    // Show warning toast
    warning(title, message = '', duration = 6000) {
        this.showToast('warning', title, message, duration);
    }

    // Show info toast
    info(title, message = '', duration = 5000) {
        this.showToast('info', title, message, duration);
    }

    // Show toast notification
    showToast(type, title, message = '', duration = 5000) {
        const container = document.querySelector('.toast-container');
        const toastId = `toast-${++this.toastId}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="notifications.closeToast('${toastId}')">&times;</button>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.closeToast(toastId), duration);
        }

        return toastId;
    }

    // Close specific toast
    closeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }

    // Close all toasts
    closeAllToasts() {
        const toasts = document.querySelectorAll('.toast');
        toasts.forEach(toast => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    // Show modal alert
    alert(title, message, type = 'info') {
        return new Promise((resolve) => {
            this.showModal(title, message, type, [
                { text: 'ОК', type: 'primary', action: () => resolve(true) }
            ]);
        });
    }

    // Show modal confirmation
    confirm(title, message, type = 'warning') {
        return new Promise((resolve) => {
            this.showModal(title, message, type, [
                { text: 'Отмена', type: 'secondary', action: () => resolve(false) },
                { text: 'ОК', type: 'primary', action: () => resolve(true) }
            ]);
        });
    }

    // Show modal with custom buttons
    showModal(title, message, type = 'info', buttons = []) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">
                        <div class="modal-icon ${type}">${icons[type]}</div>
                        ${title}
                    </div>
                </div>
                <div class="modal-body">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <div class="modal-footer">
                    ${buttons.map((btn, index) => 
                        `<button class="modal-button ${btn.type}" data-button="${index}">${btn.text}</button>`
                    ).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add button click handlers
        buttons.forEach((btn, index) => {
            const button = overlay.querySelector(`[data-button="${index}"]`);
            button.addEventListener('click', () => {
                this.closeModal();
                if (btn.action) btn.action();
            });
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal();
                if (buttons[0]?.action) buttons[0].action(); // Default to first button action
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
                if (buttons[0]?.action) buttons[0].action(); // Default to first button action
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Show modal
        setTimeout(() => overlay.classList.add('show'), 10);
    }

    // Close modal
    closeModal() {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

// Create global notification instance
const notifications = new NotificationSystem();

// Backward compatibility - replace alert and confirm
const originalAlert = window.alert;
const originalConfirm = window.confirm;

// Override native alert (optional - you can still use the old alert)
window.customAlert = (message) => {
    let title = 'Уведомление';
    let body = message;
    
    // Try to parse title from message if it contains newlines
    if (typeof message === 'string' && message.includes('\n')) {
        const lines = message.split('\n');
        if (lines.length >= 2 && lines[0].length < 100) {
            title = lines[0];
            body = lines.slice(1).join('\n').trim();
        }
    }
    
    return notifications.alert(title, body);
};

// Override native confirm (optional)
window.customConfirm = (message) => {
    let title = 'Подтверждение';
    let body = message;
    
    // Try to parse title from message if it contains newlines
    if (typeof message === 'string' && message.includes('\n')) {
        const lines = message.split('\n');
        if (lines.length >= 2 && lines[0].length < 100) {
            title = lines[0];
            body = lines.slice(1).join('\n').trim();
        }
    }
    
    return notifications.confirm(title, body);
};