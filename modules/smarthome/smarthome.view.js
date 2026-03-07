// SmartHome Rendering Engine

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    minimapCanvas: null,
    minimapCtx: null,

    init() {
        // Main canvas + overlay
        this.canvas = document.getElementById("smarthome-canvas");
        this.overlay = document.getElementById("smarthome-overlay");

        if (!this.canvas) {
            console.error("SmartHomeView: Canvas not found");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        // Mini‑Map
        this.minimapCanvas = document.getElementById("smarthome-minimap-canvas");
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext("2d");
        }

        // Initial sizing
        this._resize();
        window.addEventListener("resize", () => this._resize());

        // Draw initial content
        this._drawPlaceholder();
        this._drawMiniMap();
    },

    _resize() {
        // Main canvas
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

        // Mini‑Map canvas
        if (this.minimapCanvas) {
            this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
            this.minimapCanvas.height = this.minimapCanvas.offsetHeight;
        }
    },

    _drawPlaceholder() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.fillStyle = "#00000033";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dummy-Räume (Polygone)
        const rooms = [
            {
                name: "Wohnzimmer",
                color: "#3A3A3A",
                points: [
                    { x: 100, y: 100 },
                    { x: 400, y: 100 },
                    { x: 400, y: 300 },
                    { x: 100, y: 300 }
                ]
            },
            {
                name: "Küche",
                color: "#4A4A4A",
                points: [
                    { x: 420, y: 100 },
                    { x: 650, y: 100 },
                    { x: 650, y: 250 },
                    { x: 420, y: 250 }
                ]
            },
            {
                name: "Flur",
                color: "#2F2F2F",
                points: [
                    { x: 100, y: 320 },
                    { x: 650, y: 320 },
                    { x: 650, y: 420 },
                    { x: 100, y: 420 }
                ]
            }
        ];

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        rooms.forEach(room => {
            ctx.fillStyle = room.color;
            ctx.beginPath();
            ctx.moveTo(room.points[0].x, room.points[0].y);

            for (let i = 1; i < room.points.length; i++) {
                ctx.lineTo(room.points[i].x, room.points[i].y);
            }

            ctx.closePath();
            ctx.fill();

            // Raum-Label
            ctx.fillStyle = "var(--sh-text)";
            ctx.font = "20px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(room.name, room.points[0].x + 12, room.points[0].y + 12);

        });
    },

    _drawMiniMap() {
        const ctx = this.minimapCtx;
        if (!ctx) return;
    
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
    
        ctx.clearRect(0, 0, w, h);
    
        // Dummy-Räume für Mini-Map (vereinfachte Version)
        const rooms = [
            { x: 10, y: 10, w: 60, h: 60, color: "#3A3A3A", label: "WZ" },  // Wohnzimmer
            { x: 75, y: 10, w: 50, h: 40, color: "#4A4A4A", label: "K"  },  // Küche
            { x: 10, y: 75, w: 115, h: 30, color: "#2F2F2F", label: "F"  }   // Flur
        ];
    
        // Räume zeichnen
        rooms.forEach(r => {
            ctx.fillStyle = r.color;
            ctx.fillRect(r.x, r.y, r.w, r.h);
        });
    
        // Labels zeichnen
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "top";
    
        rooms.forEach(r => {
            ctx.fillText(r.label, r.x + 5, r.y + 5);
        });
    
        // Rahmen
        ctx.strokeStyle = "#FFFFFF55";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);
    }

};
