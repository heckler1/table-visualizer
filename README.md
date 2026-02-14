# 3D Table Visualizer

A professional-grade interactive 3D surface-plot visualizer for up to **8 × 16×16 numeric tables**. Perfect for visualizing frequency responses, gain tables, or any 2D numeric data arrays.

## 🚀 Key Features

- **Multi-Tab Interface**:
  - **Visualize Tab**: See all your tables rendered as interactive 3D surfaces in a shared coordinate system.
  - **Revise Tab**: Modify existing tables using percentage-based modifiers. Apply changes to single tables or all active tables at once.
- **Interactive 16×16 Grids**: All data entry uses real-time editable grids with built-in **Heatmap Gradients**. Cells change color based on their relative values.
- **Selection Shadowing**: Focus (click or tab) a cell in any Revise grid to see a subtle highlight at the same coordinates across the other tables, making it easy to track data relationships.
- **Support for 8 Tables**: Manage up to 8 independent datasets. Each table has a unique color identity throughout the app.
- **Smart Data Integration**:
  - Paste CSV or TSV data directly into any grid (auto-detects delimiters).
  - Export revised tables back to CSV with a single click.
- **Advanced Axis Control**: Fully configurable X, Y, and Z axes. Set custom labels, units, and precise tick values.
- **Professional 3D Viewport**: Built with Three.js. Includes smooth OrbitControls (rotate, zoom, pan), ACES Filmic tone mapping, and a dynamic legend.
- **Persistent State**: Your tables, axis configurations, and all UI settings (including Revise tab selections and modifiers) are automatically saved to your browser's local storage.

## 🛠 Tech Stack

- **Cloudflare Workers**: High-performance edge deployment.
- **Three.js**: Hardware-accelerated 3D rendering.
- **Vanilla JS/CSS**: Sleek, modern performance without the overhead of heavy frameworks.
- **Inter Font**: Clean, modern typography for maximum readability.

## 💻 Local Development

1. **Install dependencies**: `npm install`
2. **Start dev server**: `npm run dev` (Runs at `http://localhost:8787`)
3. **Deploy**: `npm run deploy`

## 📋 Usage Tips

- **Pasting**: You can paste from Excel or Google Sheets directly into any grid.
- **Revision**: In the Revise tab, enter `0.1` to increase values by 10%, or `-0.05` to decrease by 5%. Empty cells are ignored during revision.
- **Visibility**: Toggle the 👁 icon in the Sidebar to hide/show specific tables in the 3D view.
