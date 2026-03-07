// SmartHome Data Model

window.SmartHomeData = {

    // Raumtypen (Schritt 3.3)
    roomTypes: {
        living: {
            icon: "sofa",
            color: "#8F6BFF"
        },
        kitchen: {
            icon: "restaurant",
            color: "#FFB86C"
        },
        hallway: {
            icon: "meeting_room",
            color: "#5E5E5E"
        }
    },

    // Gerätetypen (Schritt 3.4)
    deviceTypes: {
        light: {
            icon: "lightbulb",
            color: "#FFD28A"
        },
        sensor: {
            icon: "sensors",
            color: "#6CE0FF"
        },
        switch: {
            icon: "toggle_on",
            color: "#A0FF6C"
        }
    },

    rooms: [
        {
            id: "wohnzimmer",
            name: "Wohnzimmer",
            type: "living",

            polygon: [
                { x: 100, y: 100 },
                { x: 400, y: 100 },
                { x: 400, y: 300 },
                { x: 100, y: 300 }
            ],

            minimap: {
                x: 10,
                y: 10,
                w: 60,
                h: 60,
                label: "WZ"
            },

            doors: [
                {
                    to: "kueche",
                    position: { x: 400, y: 200 }
                },
                {
                    to: "flur",
                    position: { x: 250, y: 300 }
                }
            ]
        },

        {
            id: "kueche",
            name: "Küche",
            type: "kitchen",

            polygon: [
                { x: 420, y: 100 },
                { x: 650, y: 100 },
                { x: 650, y: 250 },
                { x: 420, y: 250 }
            ],

            minimap: {
                x: 75,
                y: 10,
                w: 50,
                h: 40,
                label: "K"
            },

            doors: [
                {
                    to: "wohnzimmer",
                    position: { x: 420, y: 200 }
                }
            ]
        },

        {
            id: "flur",
            name: "Flur",
            type: "hallway",

            polygon: [
                { x: 100, y: 320 },
                { x: 650, y: 320 },
                { x: 650, y: 420 },
                { x: 100, y: 420 }
            ],

            minimap: {
                x: 10,
                y: 75,
                w: 115,
                h: 30,
                label: "F"
            },

            doors: [
                {
                    to: "wohnzimmer",
                    position: { x: 250, y: 320 }
                }
            ]
        }
    ],

    // Geräte (Schritt 3.4)
    devices: [
        {
            id: "lampe_wz",
            name: "Stehlampe",
            type: "light",
            icon: "lightbulb",
            room: "wohnzimmer",
            position: { x: 180, y: 220 }
        },
        {
            id: "kueche_licht",
            name: "Deckenlicht",
            type: "light",
            icon: "lightbulb",
            room: "kueche",
            position: { x: 520, y: 160 }
        },
        {
            id: "flur_sensor",
            name: "Bewegungssensor",
            type: "sensor",
            icon: "sensors",
            room: "flur",
            position: { x: 350, y: 360 }
        }
    ],

    // Navigation‑Graph Helper
    getNeighbors(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return [];
        return room.doors.map(d => d.to);
    },

    getRoom(roomId) {
        return this.rooms.find(r => r.id === roomId) || null;
    }
};
