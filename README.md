# 3D Table Visualizer

A professional-grade interactive 3D surface-plot visualizer for up to **8 × 16×16 numeric tables**. Perfect for visualizing frequency responses, gain tables, or any 2D numeric data arrays.

## 🚀 Key Features

- **Multi-Tab Interface**:
  - **Visualize Tab**: See all your tables rendered as interactive 3D surfaces in a shared coordinate system.
  - **Revise Tab**: Modify existing tables using percentage-based modifiers. Apply changes to single tables with full visual feedback.
  - **3D Comparison View**: Toggle "Show 3D Comparison" in the Revise tab to see the **Old** (source) and **New** (output) heatmaps overlaid in 3D.
- **Interactive 16×16 Grids**: All data entry uses real-time editable grids with built-in **Heatmap Gradients**. Cells change color based on their relative values.
- **Table Quick-Actions**:
  - **Undo (↩)**: Global undo functionality that tracks the last 50 changes across all tables. Supports **Ctrl+Z / Cmd+Z**.
  - **Copy (📋)**: Instantly copies table data in TSV format, formatted to 3 decimal places for perfect spreadsheet integration.
  - **Clear (🗑)**: Resets the table data, clears heatmap colors, and wipes the corresponding 3D mesh.
- **Linked Selections (Revise Tab)**: The "Source Table" and "Apply To" targets are linked—selecting a table to revise automatically prepares it for application, streamlining your workflow.
- **Selection Shadowing**: Focus a cell in any grid to see a shared highlight across all related grids (Base Table, Modifiers, and Output).
- **Smart Data Integration**:
  - Paste TSV/CSV data directly into any grid (auto-detects delimiters).
  - Interprets leading newlines in pasted data as vertical offsets (empty rows).
- **Advanced 3D Visualization**:
  - **Mesh Heatmaps**: Optional vertex-colored gradients on 3D meshes that match the 2D grid's heatmap.
  - **3-Decimal Precision**: Strict enforcement of 3 decimal places (e.g., `10.500`) for all values in the UI and clipboard.
  - **Configurable Axes**: Fully customized X, Y, and Z labels, units, and precise tick values.
- **Enhanced Persistence**: Your tables, axis configurations, revision settings, visualization preferences, and even your **active tab** are automatically saved across refreshes.
- **Divergence Highlighting**:
  - **Vertical Pillars**: Interactive 3D spikes connect the "Old" and "New" surfaces in Revise mode.
  - **Color-Coded Deltas**: Spikes are colored **green** for value increases and **red** for decreases.

## 🛠 Tech Stack

- **Cloudflare Workers**: High-performance edge deployment.
- **Three.js**: Hardware-accelerated 3D rendering.
- **Vanilla JS/CSS**: Sleek, modern performance without heavy frameworks.
- **Inter Font**: Clean, modern typography for maximum readability.

## 💻 Local Development

1. **Install dependencies**: `npm install`
2. **Start dev server**: `npm run dev` (Runs at `http://localhost:8787`)
3. **Deploy**: `npm run deploy`

## 📋 Usage Tips

- **Pasting**: You can paste from Excel or Sheets directly. Leading empty rows in your selection will be preserved as offsets.
- **Revision**: In the Revise tab, enter `5` to increase values by 5%, or `-10` to decrease by 10%. Empty cells are ignored.
- **Visibility**: Toggle the 👁 icon in the sidebar to hide/show specific tables in the 3D scene.
- **Mesh Gradients**: Enable "Mesh Gradients" in Visualization Settings to mirror heatmap colors on the 3D surface.
