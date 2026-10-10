import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

/**
 * Initializes and returns a singleton Socket.io client instance for real-time collaboration.
 */
export function getSocketClient(): Socket {
  if (!socketInstance) {
    const socketUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

    socketInstance = io(socketUrl, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });
  }
  return socketInstance;
}

/**
 * Helper to join a trip room and listen for real-time collaborative updates.
 */
export function subscribeToTripUpdates(
  tripId: string,
  callbacks: {
    onItineraryUpdate?: (data: any) => void;
    onExpenseUpdate?: (data: any) => void;
    onMemberUpdate?: (data: any) => void;
  }
) {
  const socket = getSocketClient();
  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("join-trip", { tripId });

  if (callbacks.onItineraryUpdate) {
    socket.on("itinerary-update", callbacks.onItineraryUpdate);
  }
  if (callbacks.onExpenseUpdate) {
    socket.on("expense-update", callbacks.onExpenseUpdate);
  }
  if (callbacks.onMemberUpdate) {
    socket.on("member-update", callbacks.onMemberUpdate);
  }

  return () => {
    socket.emit("leave-trip", { tripId });
    if (callbacks.onItineraryUpdate) socket.off("itinerary-update", callbacks.onItineraryUpdate);
    if (callbacks.onExpenseUpdate) socket.off("expense-update", callbacks.onExpenseUpdate);
    if (callbacks.onMemberUpdate) socket.off("member-update", callbacks.onMemberUpdate);
  };
}
