export const ToastUI = {
    showToast(message, isError = false) {
        const oldToast = document.getElementById('app-toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.innerText = message;

        toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg text-white font-bold text-sm transform transition-all duration-300 z-50 ${
            isError ? 'bg-red-600 animate-shake' : 'bg-green-600'
        }`;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};