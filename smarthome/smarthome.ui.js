window.SmartHomeUI = {

    init() {
        this.bindObjectHeader();
        this.renderSidebar();
        this.bindSmartHomeEvents();
    },

    // --------------------------------------------------
    // Objekt-Header (O3 Overlay)
    // --------------------------------------------------
    bindObjectHeader() {
        const header = document.getElementById("sh-object-header");
        const overlay = document.getElementById("sh-object-overlay");

        header.addEventListener("click", () => {
            overlay.classList.toggle("hidden");
        });

        overlay.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                const action = btn.dataset.action;
                SmartHomeModule.handleObjectAction(action);
                overlay.classList.add("hidden");
            });
        });

        document.addEventListener("click", (e) => {
            if (!overlay.contains(e.target) && !header.contains(e.target)) {
                overlay.classList.add("hidden");
            }
        });
    },

    // --------------------------------------------------
    // Sidebar Rendering
    // --------------------------------------------------
    renderSidebar() {
        this.renderFloors();
        this.renderRooms();
        this.renderStatus();
        this.renderFavorites();
    },

    renderFloors() {
        const container = document.getElementById("sh-floors");
        container.innerHTML = "";

        SmartHomeData.floors.forEach(floor => {
            const div = document.createElement("div");
            div.className = "sh-floor-item";
            div.textContent = floor.name;

            div.addEventListener("click", () => {
                SmartHomeView.setFloor(floor.id);
                this.renderRooms();
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    renderRooms() {
        const container = document.getElementById("sh-rooms");
        container.innerHTML = "";

        const activeFloor = SmartHomeView.activeFloor;
        if (!activeFloor) return;

        const rooms = SmartHomeData.rooms.filter(r => r.floor === activeFloor);

        rooms.forEach(room => {
            const div = document.createElement("div");
            div.className = "sh-room-item";
            div.textContent = room.name;

            div.addEventListener("click", () => {
                SmartHomeView.setRoom(room.id);
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    renderStatus() {
        document.getElementById("sh-status-devices").textContent =
            SmartHomeData.devices.length;

        document.getElementById("sh-status-conn").textContent =
            SmartHomeData.connectionStatus || "OK";

        document.getElementById("sh-status-warn").textContent =
            SmartHomeData.warnings.length;
    },

    renderFavorites() {
        const container = document.querySelector("#sh-favorites .fav-list");
        container.innerHTML = "";

        SmartHomeData.favorites.forEach(roomId => {
            const room = SmartHomeData.rooms.find(r => r.id === roomId);
            if (!room) return;

            const div = document.createElement("div");
            div.className = "sh-fav-item";
            div.textContent = room.name;

            div.addEventListener("click", () => {
                SmartHomeView.setRoom(room.id);
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    // --------------------------------------------------
    // Breadcrumbs
    // --------------------------------------------------
    updateBreadcrumb() {
        const bc = document.getElementById("sh-breadcrumb");

        const floor = SmartHomeData.floors.find(f => f.id === SmartHomeView.activeFloor);
        const room = SmartHomeData.rooms.find(r => r.id === SmartHomeView.activeRoom);

        bc.textContent = floor && room
            ? `${floor.name} → ${room.name}`
            : "";
    },

    // --------------------------------------------------
    // SmartHomeView Events
    // --------------------------------------------------
    bindSmartHomeEvents() {
        document.addEventListener("SmartHomeView:roomChanged", () => {
            this.updateBreadcrumb();
        });

        document.addEventListener("SmartHomeView:floorChanged", () => {
            this.renderRooms();
            this.updateBreadcrumb();
        });
    }
};
