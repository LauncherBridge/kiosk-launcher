// modules/smarthome/smarthome.groups.js
// 4.3.A – Automatische Gruppen (Raumcluster über offene Durchgänge)

window.SmartHomeGroups = {
    // Ergebnisstruktur:
    // autoGroups: [{ id, roomIds: [], label }]
    autoGroups: [],
    // später: manualGroups: [], priority-Logik etc.

    init() {
        this._buildAutoGroups();
    },

    /**
     * Berechnet automatische Gruppen basierend auf "offenen Durchgängen"
     * Annahme:
     * - SmartHomeData.rooms[*].passages = [
     *      { to: "roomIdB" },
     *      { to: "roomIdC" }
     *   ]
     * - Durchgänge sind bidirektional gedacht (A <-> B)
     */
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

    /**
     * Erzeugt einen einfachen Label-Text für eine automatische Gruppe,
     * z. B. "Wohnbereich" oder "Gruppe: Küche + Essen + Wohnen"
     */
    _buildAutoGroupLabel(roomIds) {
        const names = roomIds
            .map(id => SmartHomeData.getRoom(id))
            .filter(r => !!r)
            .map(r => r.name);

        if (names.length === 0) return "Gruppe";

        if (names.length === 1) return names[0];

        if (names.length === 2) {
            return `${names[0]} + ${names[1]}`;
        }

        // Mehr als 2 Räume: ersten 2 nennen, Rest als "..."
        return `${names[0]} + ${names[1]} + …`;
    },

    /**
     * Liefert die automatische Gruppe, zu der ein Raum gehört (oder null).
     */
    getAutoGroupForRoom(roomId) {
        for (const g of this.autoGroups) {
            if (g.roomIds.includes(roomId)) {
                return g;
            }
        }
        return null;
    },

    /**
     * Liefert alle Räume einer Gruppe (auto), als Room-Objekte.
     */
    getRoomsOfAutoGroup(groupId) {
        const g = this.autoGroups.find(x => x.id === groupId);
        if (!g) return [];
        return g.roomIds
            .map(id => SmartHomeData.getRoom(id))
            .filter(r => !!r);
    }
};

