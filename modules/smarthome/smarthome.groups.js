// modules/smarthome/smarthome.groups.js
// 4.3 – Gruppenlogik (automatisch + manuell + Priorisierung)

window.SmartHomeGroups = {
    // Automatische Gruppen (aus offenen Durchgängen)
    autoGroups: [],

    // Manuelle Gruppen (Editor)
    // Struktur:
    // { id, name, roomIds: [] }
    manualGroups: [],

    init() {
        this._buildAutoGroups();
        this._loadManualGroups();
    },

    // ---------------------------------------------------------
    // 4.3.A – Automatische Gruppen
    // ---------------------------------------------------------

    _buildAutoGroups() {
        this.autoGroups = [];

        if (!window.SmartHomeData || !Array.isArray(SmartHomeData.rooms)) {
            console.warn("SmartHomeGroups: SmartHomeData.rooms nicht verfügbar.");
            return;
        }

        const rooms = SmartHomeData.rooms;
        const visited = new Set();
        let groupIndex = 1;

        const getRoomById = (id) => rooms.find(r => r.id === id);

        const dfs = (startRoomId, currentGroup) => {
            const stack = [startRoomId];

            while (stack.length > 0) {
                const roomId = stack.pop();
                if (visited.has(roomId)) continue;
                visited.add(roomId);
                currentGroup.push(roomId);

                const room = getRoomById(roomId);
                if (!room || !Array.isArray(room.passages)) continue;

                for (const passage of room.passages) {
                    const targetId = passage.to;
                    if (!targetId) continue;
                    if (!visited.has(targetId)) {
                        stack.push(targetId);
                    }
                }
            }
        };

        for (const room of rooms) {
            if (visited.has(room.id)) continue;

            const groupRoomIds = [];
            dfs(room.id, groupRoomIds);

            if (groupRoomIds.length > 1) {
                this.autoGroups.push({
                    id: `auto_${groupIndex++}`,
                    roomIds: groupRoomIds,
                    label: this._buildAutoGroupLabel(groupRoomIds)
                });
            }
        }
    },

    _buildAutoGroupLabel(roomIds) {
        const names = roomIds
            .map(id => SmartHomeData.getRoom(id))
            .filter(r => !!r)
            .map(r => r.name);

        if (names.length === 0) return "Gruppe";
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} + ${names[1]}`;
        return `${names[0]} + ${names[1]} + …`;
    },

    getAutoGroupForRoom(roomId) {
        for (const g of this.autoGroups) {
            if (g.roomIds.includes(roomId)) {
                return g;
            }
        }
        return null;
    },

    getRoomsOfAutoGroup(groupId) {
        const g = this.autoGroups.find(x => x.id === groupId);
        if (!g) return [];
        return g.roomIds
            .map(id => SmartHomeData.getRoom(id))
            .filter(r => !!r);
    },

    // ---------------------------------------------------------
    // 4.3.B – Manuelle Gruppen (Editor)
    // ---------------------------------------------------------

    _loadManualGroups() {
        try {
            const raw = localStorage.getItem("smarthome_manual_groups");
            if (!raw) {
                this.manualGroups = [];
                return;
            }
            this.manualGroups = JSON.parse(raw);
        } catch (e) {
            console.error("SmartHomeGroups: Fehler beim Laden der manuellen Gruppen:", e);
            this.manualGroups = [];
        }
    },

    _saveManualGroups() {
        try {
            localStorage.setItem("smarthome_manual_groups", JSON.stringify(this.manualGroups));
        } catch (e) {
            console.error("SmartHomeGroups: Fehler beim Speichern der manuellen Gruppen:", e);
        }
    },

    createManualGroup(name, roomIds) {
        const id = `manual_${Date.now()}`;
        const group = { id, name, roomIds: [...roomIds] };
        this.manualGroups.push(group);
        this._saveManualGroups();
        return group;
    },

    deleteManualGroup(groupId) {
        this.manualGroups = this.manualGroups.filter(g => g.id !== groupId);
        this._saveManualGroups();
    },

    getManualGroupForRoom(roomId) {
        for (const g of this.manualGroups) {
            if (g.roomIds.includes(roomId)) {
                return g;
            }
        }
        return null;
    },

    getRoomsOfManualGroup(groupId) {
        const g = this.manualGroups.find(x => x.id === groupId);
        if (!g) return [];
        return g.roomIds
            .map(id => SmartHomeData.getRoom(id))
            .filter(r => !!r);
    },

    // ---------------------------------------------------------
    // 4.3.C – Priorisierung (manuell > automatisch > Einzelraum)
    // ---------------------------------------------------------

    /**
     * Liefert die effektive Gruppe eines Raums:
     * 1. Manuelle Gruppe (höchste Priorität)
     * 2. Automatische Gruppe
     * 3. null (Einzelraum)
     *
     * Rückgabeformat:
     * {
     *   type: "manual" | "auto" | "single",
     *   group: { id, name?, roomIds: [] } | null
     * }
     */
    getEffectiveGroupForRoom(roomId) {
        // 1. Manuelle Gruppe gewinnt immer
        const manual = this.getManualGroupForRoom(roomId);
        if (manual) {
            return {
                type: "manual",
                group: manual
            };
        }

        // 2. Automatische Gruppe
        const auto = this.getAutoGroupForRoom(roomId);
        if (auto) {
            return {
                type: "auto",
                group: auto
            };
        }

        // 3. Einzelraum
        return {
            type: "single",
            group: null
        };
    }
};
