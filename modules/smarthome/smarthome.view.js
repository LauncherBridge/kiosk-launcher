// SmartHome Rendering Engine

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    init() {
        this.canvas = document.getElementById("smarthome-canvas");
        this.overlay = document.getElementById("smarthome-overlay");

        if (!this.canvas) {
            console.error("SmartHomeView: Canvas not found");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        this._resize();
        window.addEventListener("resize", () => this._resize());

        this._drawPlaceholder();
    },

    _resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    },

    _drawPlaceholder() {
        const ctx = this.ctx;
        if (!ctx) return;

        // Hintergrund leicht abdunkeln (optional)
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
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "18px sans-serif";
            ctx.fillText(room.name, room.points[0].x + 10, room.points[0].y + 25);
        });
    }
};

