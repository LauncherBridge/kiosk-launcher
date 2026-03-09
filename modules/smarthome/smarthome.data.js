// SmartHome Data Model

window.SmartHomeData = {

    // ---------------------------------------------------------
    // ETAGEN (4.12 – automatisch abgeleitet)
    // ---------------------------------------------------------
    floors: [],

    deriveFloorsFromRooms() {
        const floors = new Map();

        this.rooms.forEach(room => {
            if (room.floor === undefined || room.floor === null) return;

            const id = Number(room.floor);

            if (!floors.has(id)) {
                floors.set(id, {
                    id,
                    alias: null,
                    rooms: []
                });
            }

            floors.get(id).rooms.push(room.id);
        });

        // Sortieren: höchste Etage zuerst
        this.floors = [...floors.values()].sort((a, b) => b.id - a.id);
    },
    
    refreshFloors() {
        this.deriveFloorsFromRooms();
    
        // später: Events für View, Minimap, Canvas
        // z.B. SmartHomeEvents.emit("floorsChanged");
    },

    setFloorAlias(floorId, alias) {
        const f = this.floors.find(x => x.id === floorId);
        if (!f) return;
        f.alias = alias;
    },

    getFloorDisplayName(floorId) {
        const f = this.floors.find(x => x.id === floorId);
        if (!f) return String(floorId);

        return f.alias || this._defaultFloorName(floorId);
    },

    _defaultFloorName(id) {
        if (id === 0) return "Erdgeschoss";
        if (id > 0) return `${id}. Obergeschoss`;
        return `${Math.abs(id)}. Untergeschoss`;
    },

    // ---------------------------------------------------------
    // Persistente Etagen-Metadaten (Aliase)
    // ---------------------------------------------------------
    floorMeta: {},

    loadFloorMeta() {
        try {
            const raw = localStorage.getItem("smarthome_floor_meta");
            this.floorMeta = raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error("SmartHomeData: Fehler beim Laden der Etagen-Metadaten:", e);
            this.floorMeta = {};
        }
    },

    saveFloorMeta() {
        try {
            localStorage.setItem("smarthome_floor_meta", JSON.stringify(this.floorMeta));
        } catch (e) {
            console.error("SmartHomeData: Fehler beim Speichern der Etagen-Metadaten:", e);
        }
    },

    applyFloorMeta() {
        this.floors.forEach(floor => {
            if (this.floorMeta[floor.id]?.alias) {
                floor.alias = this.floorMeta[floor.id].alias;
            }
        });
    },

    setFloorAlias(floorId, alias) {
        if (!this.floorMeta[floorId]) {
            this.floorMeta[floorId] = {};
        }
        this.floorMeta[floorId].alias = alias;
        this.saveFloorMeta();
        this.refreshFloors();
    },

    refreshFloors() {
        this.deriveFloorsFromRooms();
        this.applyFloorMeta();
        // später: Events für View, Minimap, Canvas
    },

    
    
    // ---------------------------------------------------------
    // Raumtypen (Schritt 3.3)
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // Gerätetypen (Schritt 3.4)
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // SmartDeviceContainer (Schritt 3.5 + 4.2.1 Statusmodell)
    // ---------------------------------------------------------
    containers: [
        {
            id: "wz_lampe_1",
            name: "Stehlampe Wohnzimmer",
            type: "light",
            room: "wohnzimmer",
            position: { x: 180, y: 220 },

            state: {
                on: false,
                brightness: 100,
                color: null,
                sensor: {
                    temperature: null,
                    humidity: null,
                    motion: null
                },
                reachable: true,
                lastUpdate: null
            },

            devices: [
                {
                    id: "shellyplus1pm-ABC123",
                    vendor: "shelly",
                    model: "Plus 1PM",
                    installedAt: "2026-03-01",
                    removedAt: null
                }
            ],

            history: {
                energy: [],
                power: [],
                events: []
            }
        },

        {
            id: "kueche_licht_1",
            name: "Deckenlicht Küche",
            type: "light",
            room: "kueche",
            position: { x: 520, y: 160 },

            state: {
                on: false,
                brightness: 100,
                color: null,
                sensor: {
                    temperature: null,
                    humidity: null,
                    motion: null
                },
                reachable: true,
                lastUpdate: null
            },

            devices: [
                {
                    id: "shellyplus1pm-KUECHE",
                    vendor: "shelly",
                    model: "Plus 1PM",
                    installedAt: "2026-03-01",
                    removedAt: null
                }
            ],

            history: {
                energy: [],
                power: [],
                events: []
            }
        },

        {
            id: "flur_sensor_1",
            name: "Bewegungssensor Flur",
            type: "sensor",
            room: "flur",
            position: { x: 350, y: 360 },

            state: {
                on: false,
                brightness: 100,
                color: null,
                sensor: {
                    temperature: null,
                    humidity: null,
                    motion: null
                },
                reachable: true,
                lastUpdate: null
            },

            devices: [
                {
                    id: "shelly-motion-XYZ",
                    vendor: "shelly",
                    model: "Motion 2",
                    installedAt: "2026-03-01",
                    removedAt: null
                }
            ],

            history: {
                energy: [],
                power: [],
                events: []
            }
        }
    ],

    // ---------------------------------------------------------
    // Räume
    // ---------------------------------------------------------
    rooms: [
        {
            id: "wohnzimmer",
            name: "Wohnzimmer",
            type: "living",
            floor: 0,

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
            floor: 0,

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
            floor: 0,

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

    // ---------------------------------------------------------
    // Navigation‑Graph Helper
    // ---------------------------------------------------------
    getNeighbors(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return [];
        return room.doors.map(d => d.to);
    },

    getRoom(roomId) {
        return this.rooms.find(r => r.id === roomId) || null;
    },

    getContainer(containerId) {
        return this.containers.find(c => c.id === containerId) || null;
    },

    // ---------------------------------------------------------
    // STATUSBERECHNUNG PRO RAUM
    // ---------------------------------------------------------
    getRoomStatus(roomId) {
        const containers = this.containers.filter(c => c.room === roomId);
        if (containers.length === 0) return "gray";

        const total = containers.length;
        const reachable = containers.filter(c => c.state?.reachable).length;

        if (reachable === total) return "green";
        if (reachable === 0) return "red";
        return "yellow";
    },

    // ---------------------------------------------------------
    // STATUSBERECHNUNG PRO ETAGE (KUMULIERT)
    // ---------------------------------------------------------
    getFloorStatus(floorId) {
        const floor = this.floors?.find(f => f.id === floorId);
        if (!floor) return "gray";

        let allContainers = [];

        floor.rooms.forEach(roomId => {
            const roomContainers = this.containers.filter(c => c.room === roomId);
            allContainers.push(...roomContainers);
        });

        if (allContainers.length === 0) return "gray";

        const total = allContainers.length;
        const reachable = allContainers.filter(c => c.state?.reachable).length;

        if (reachable === total) return "green";
        if (reachable === 0) return "red";
        return "yellow";
    }
};

// ---------------------------------------------------------
// Automatische Etagen-Ableitung direkt nach Laden der Räume
// ---------------------------------------------------------
window.SmartHomeData.deriveFloorsFromRooms();
