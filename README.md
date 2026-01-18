# PDF Template Automation Engine

A web application that automatically maps data to PDF templates to generate completed PDFs.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-green)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)

## ✨ Key Features

### 🎯 Core Features

- **📄 PDF Template Upload**: Upload and manage A4 PDF templates
- **🎨 Visual Field Mapping**: Drag and drop to specify data paths for template fields
- **⚡ Real-time Preview**: Instantly check field placement
- **💾 Real-time Testing**: Test rendering before saving
- **🔄 Automatic PDF Generation**: Automatically generate completed PDFs from JSON data
- **🔌 REST API**: Use via HTTP API from programs

### 🛠️ Editing Features

- **Property Editing**: Real-time adjustment of position (X, Y), size (width, height), font, alignment
- **Field Management**: Add, delete, select fields
- **Template Management**: Individual/bulk delete support

## 🏗️ Tech Stack

### Backend

- **FastAPI** (0.104.1) - High-performance Python web framework
- **PyMuPDF (fitz)** (1.23.8) - PDF information extraction and image rendering
- **pypdf** (3.17.1) - PDF merging
- **Uvicorn** - ASGI server

### Frontend

- **React** (18.2.0) - UI framework
- **Vite** (5.0.8) - Fast build tool
- **Axios** (1.6.2) - HTTP client

## 🚀 Quick Start

### Prerequisites

- Python 3.9 or higher
- Node.js 16 or higher
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/CobyApp/report.git
cd report
```

### 2. Run All at Once (Recommended)

```bash
# Start backend + frontend simultaneously
./start.sh

# Stop
./stop.sh

# Restart
./restart.sh
```

### 3. Run Individually

**Terminal 1 - Backend:**

```bash
cd backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install packages (first time only)
pip install -r requirements.txt

# Run server
python -m app.main
```

**Terminal 2 - Frontend:**

```bash
cd frontend

# Install packages (first time only)
npm install

# Run development server
npm run dev
```

### 4. Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: 
  - **Swagger UI** (Interactive): http://localhost:8000/docs
  - **ReDoc** (Alternative): http://localhost:8000/redoc

## 📖 Usage

### 1. Upload Template

1. Access `http://localhost:3000` in web browser
2. Click "Upload PDF Template" button
3. Select A4 PDF template file

### 2. Field Mapping

1. Click uploaded template card to enter edit mode
2. **Drag** on PDF preview to select field area
3. Enter data path in input popup (e.g., `customer.name`, `items[0].price`)
4. Add fields as needed

### 3. Property Editing

1. Click field to select
2. Modify in right property panel:
   - **Data Path**: JSON path to map to field
   - **X, Y**: Field position (PDF coordinates)
   - **Width, Height**: Field size
   - **Font Size**: Text size
   - **Alignment**: Left/Center/Right

### 4. Test Rendering

1. Click "🧪 Test Rendering" button
2. Enter values for each field (prompt)
3. Completed PDF automatically downloads
4. **Changes are reflected before saving**

### 5. Save

1. Click "💾 Save" button
2. Template mapping information is saved to server

## 📡 API Documentation

### Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/templates` | Upload PDF template |
| `GET` | `/api/templates` | List templates |
| `GET` | `/api/templates/{id}` | Get template details |
| `PUT` | `/api/templates/{id}/mapping` | Save template mapping |
| `POST` | `/api/render/{id}` | Generate PDF (requires data) |
| `GET` | `/api/templates/{id}/preview` | Page preview image |
| `DELETE` | `/api/templates/{id}` | Delete template |
| `DELETE` | `/api/templates` | Delete all templates |

### Usage Examples

#### Upload Template

```bash
curl -X POST http://localhost:8000/api/templates \
  -F "file=@template.pdf"
```

**Response:**
```json
{
  "template_id": "uuid-here",
  "filename": "template.pdf",
  "page_count": 1,
  "page_size": {"w_pt": 595.28, "h_pt": 841.89}
}
```

#### Save Template Mapping

```bash
curl -X PUT http://localhost:8000/api/templates/{template_id}/mapping \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "elem1",
        "type": "text",
        "page": 1,
        "bbox": {"x": 100, "y": 100, "w": 200, "h": 20},
        "data_path": "customer.name",
        "style": {"font": "Helvetica", "size": 10, "align": "left"}
      }
    ]
  }'
```

#### Generate PDF

Generate a completed PDF by providing field data that matches your template's data paths.

**Request:**
```bash
curl -X POST http://localhost:8000/api/render/{template_id} \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "address": "123 Main St"
    },
    "items": [
      {"name": "Item 1", "price": 10000, "quantity": 2},
      {"name": "Item 2", "price": 20000, "quantity": 1}
    ],
    "checked": true,
    "total": 40000,
    "date": "2024-01-17"
  }' \
  --output result.pdf
```

**Response:**
- Content-Type: `application/pdf`
- Body: Binary PDF file
- Filename: `rendered_{template_id}.pdf`

**Request Body Structure:**
```json
{
  // Field data that matches template data paths
  // Example: if template has "customer.name", provide:
  "customer": {
    "name": "John Doe"
  },
  
  // Array fields: use "items[0].price" in template
  "items": [
    {"name": "Item 1", "price": 10000}
  ],
  
  // Simple boolean fields
  "checked": true,
  
  // Optional: Override template elements for testing
  "_elements": [
    {
      "id": "elem1",
      "type": "text",
      "page": 1,
      "bbox": {"x": 100, "y": 100, "w": 200, "h": 20},
      "data_path": "customer.name"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid data or template structure
  ```json
  {"detail": "Template structure error: ..."}
  ```

- `401 Unauthorized`: Authentication required
  ```json
  {"detail": "Authentication required"}
  ```

- `403 Forbidden`: Template does not belong to user
  ```json
  {"detail": "Access denied"}
  ```

- `404 Not Found`: Template not found
  ```json
  {"detail": "Template not found"}
  ```

**Real-time elements transmission (test rendering):**

Include `_elements` in the request body to override template elements without saving:

```bash
curl -X POST http://localhost:8000/api/render/{template_id} \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {"name": "John Doe"},
    "_elements": [
      {
        "id": "elem1",
        "type": "text",
        "page": 1,
        "bbox": {"x": 100, "y": 100, "w": 200, "h": 20},
        "data_path": "customer.name"
      }
    ]
  }' \
  --output result.pdf
```

**API Documentation:**

For interactive API documentation and detailed request/response schemas, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📁 Project Structure

```
report/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app and API endpoints
│   │   └── services/
│   │       ├── pdf_service.py      # PDF processing (upload, preview)
│   │       ├── template_service.py # Template save/load
│   │       ├── render_service.py   # PDF rendering engine
│   │       └── auth_service.py    # Authentication service
│   ├── templates/          # Template JSON storage (auto-generated)
│   ├── uploads/            # Uploaded PDFs and generated PDFs (auto-generated)
│   ├── users/              # User data (auto-generated)
│   └── requirements.txt    # Python package dependencies
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   └── components/
│   │       ├── TemplateList.jsx    # Template list
│   │       └── TemplateEditor.jsx  # Template editor
│   ├── package.json        # Node.js package dependencies
│   └── vite.config.js      # Vite configuration
│
├── start.sh               # Start backend + frontend simultaneously
├── stop.sh                # Stop servers
├── restart.sh             # Restart servers
└── README.md              # This file
```

## 📐 Template JSON Structure

Templates are saved in JSON format:

```json
{
  "template_id": "uuid",
  "filename": "template.pdf",
  "page_size": {
    "w_pt": 595.28,
    "h_pt": 841.89
  },
  "pages": [
    {
      "page": 1,
      "width": 595.28,
      "height": 841.89,
      "width_pt": 595.28,
      "height_pt": 841.89
    }
  ],
  "elements": [
    {
      "id": "elem_1234567890",
      "type": "text",
      "page": 1,
      "bbox": {
        "x": 100,
        "y": 200,
        "w": 200,
        "h": 20
      },
      "data_path": "customer.name",
      "style": {
        "font": "Helvetica",
        "size": 10,
        "align": "left"
      },
      "overflow": {
        "mode": "shrink_to_fit",
        "min_size": 7
      }
    }
  ],
  "created_at": "2026-01-17T..."
}
```

### Field Descriptions

- `bbox`: Field position and size (PDF coordinate system, point units)
  - `x`, `y`: Top-left corner coordinates (stored in screen coordinates, converted during rendering)
  - `w`, `h`: Width, height
- `data_path`: JSON data path (e.g., `customer.name`, `items[0].price`)
- `style`: Text style settings
- `overflow`: Text overflow handling (currently supports `shrink_to_fit`)

## ✅ Supported Features

- ✅ **Text Fields**: Data path mapping, alignment, auto-shrink
- ✅ **Checkboxes**: Boolean value display
- ✅ **Repeat Tables**: List data repeat rendering
- ✅ **Multi-page**: Multiple page support
- ✅ **Real-time Editing**: Test before saving
- ✅ **Property Editing**: Real-time adjustment of position, size, style
- ✅ **User Authentication**: Login/registration for user-specific data management

## 🔮 Future Improvements

- [ ] Image fields (signatures, stamps, QR codes)
- [ ] Conditional display (if statements)
- [ ] Automatic page overflow handling
- [ ] Improved CJK font support
- [ ] Rich text (partial bold, colors, etc.)
- [ ] Data schema validation UI
- [ ] Template version management
- [ ] User authentication and permission management

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check ports
lsof -ti:8000  # Backend
lsof -ti:3000  # Frontend

# Kill processes
kill -9 $(lsof -ti:8000)
kill -9 $(lsof -ti:3000)
```

### Package Installation Errors

**Backend:**
```bash
# Check virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Frontend:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🤝 Contributing

Issues and pull requests are welcome!

## 📄 License

MIT License

---

**Project Link**: [https://github.com/CobyApp/report](https://github.com/CobyApp/report)
