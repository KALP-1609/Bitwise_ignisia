const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export const api = {
    // Standard GET request
    getSystemStats: async () => {
        // 🚨 FIX: Added /api to match FastAPI routing
        const response = await fetch(`${API_URL}/api/stats`);
        
        // 🚨 FIX: Force fetch to throw an error if the status is 404, 500, etc.
        if (!response.ok) {
            throw new Error(`Backend rejected the request: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    },

    // POST request to calibrate the model
    calibrateModel: async (payload) => {
        const response = await fetch(`${API_URL}/api/profiles/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Calibration failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    },

    // Get the WebSocket URL for the live stream
    getStreamUrl: () => {
        return `${WS_URL}/ws/stream`;
    }
};