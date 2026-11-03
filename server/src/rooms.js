import { EventEmitter } from "node:events";

// Клас кімнати успадковує EventEmitter
export class Room extends EventEmitter {
  constructor(id, name, maxPlayers = 4) {
    super();
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
  }

  // Фіксуємо події для логу матчу
  logEvent(type, data = {}) {
    this.emit("match_event", {
      t: Date.now(),
      type,
      ...data
    });
  }

  addPlayer(socket, playerInfo) {
    if (this.players.size >= this.maxPlayers) return false;
    
    this.players.set(socket, playerInfo);
    this.emit("join", playerInfo);
    this.logEvent("player_join", { name: playerInfo.name });
    
    this.broadcastRoster();
    return true;
  }

  removePlayer(socket) {
    const player = this.players.get(socket);
    if (player) {
      this.players.delete(socket);
      this.emit("leave", player);
      this.logEvent("player_leave", { name: player.name });
      
      this.broadcastRoster();

      if (this.players.size === 0) {
        this.emit("empty");
      }
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const socket of this.players.keys()) {
      if (socket.readyState === 1) { // 1 = OPEN
        socket.send(data);
      }
    }
  }

  broadcastRoster() {
    const roster = Array.from(this.players.values());
    this.broadcast({ type: "roster", players: roster });
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    
    this.createRoom("room-1", "Альфа Орбіта");
    this.createRoom("room-2", "Астероїдний Пояс");
  }

  createRoom(id, name) {
    const room = new Room(id, name);
    this.rooms.set(id, room);
    
    room.once("empty", () => {
      if (this.rooms.size > 2) {
        this.rooms.delete(id);
      }
    });
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  getPublicList() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      players: r.players.size,
      maxPlayers: r.maxPlayers
    }));
  }
}