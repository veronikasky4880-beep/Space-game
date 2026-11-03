import { fetchJson } from "./assets/loader.js";

// Клас Лоббі успадковує EventTarget для відправки внутрішніх подій гри
export class Lobby extends EventTarget {
  constructor() {
    super();
    this.rooms = [];
    this.abortController = null;
    this.refreshInterval = null;
    this.socket = null;
  }

  // Запит списку доступних кімнат із сервера
  async fetchRooms() {
    try {
      // Запитуємо API кімнат з сервера
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error(`HTTP помилка! Статус: ${res.status}`);
      const rooms = await res.json();
      
      this.rooms = rooms;
      this.dispatchEvent(new CustomEvent("roomsUpdated", { detail: this.rooms }));
    } catch (err) {
      console.error("Помилка завантаження кімнат:", err);
    }
  }

  // Запуск періодичного оновлення списку кімнат
  startPolling() {
    this.fetchRooms();
    this.refreshInterval = setInterval(() => this.fetchRooms(), 3000);
  }

  // Зупинка оновлення при переході в гру
  stopPolling() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.abortController) this.abortController.abort();
  }

  // Підключення до WebSocket-сервера
  connectSocket(roomId, playerName) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket підключено");
      // Надсилаємо серверу повідомлення про вхід у кімнату
      this.socket.send(JSON.stringify({
        type: "join",
        roomId: roomId,
        name: playerName
      }));
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("Отримано від сервера:", msg);

        if (msg.type === "joined") {
          this.dispatchEvent(new CustomEvent("joinedRoom", { detail: msg }));
        }
      } catch (e) {
        console.error("Помилка обробки повідомлення сокета:", e);
      }
    };

    this.socket.onerror = (err) => {
      console.error("Помилка WebSocket:", err);
    };

    this.socket.onclose = () => {
      console.log("З'єднання WebSocket закрито");
    };
  }
}