export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  link?: string;
}

class ToastStore {
  private toasts: ToastMessage[] = [];
  private listeners: ((toasts: ToastMessage[]) => void)[] = [];

  subscribe(listener: (toasts: ToastMessage[]) => void) {
    this.listeners.push(listener);
    listener(this.toasts);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  addToast(toast: Omit<ToastMessage, "id">) {
    const id = Math.random().toString(36).substring(2, 9);
    this.toasts.push({ ...toast, id });
    this.notify();

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(id);
    }, 5000);
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const toastStore = new ToastStore();
