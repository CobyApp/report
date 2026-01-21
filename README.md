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

- **Docker** and **Docker Compose** (for local development)
- **AWS CLI** (for deployment)
- Python 3.9+ and Node.js 16+ (optional, for development without Docker)

### 1. Clone Repository

```bash
git clone https://github.com/CobyApp/report.git
cd report
```

### 2. Run with Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access:**
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Documentation**: 
  - **Swagger UI**: http://localhost:8000/docs
  - **ReDoc**: http://localhost:8000/redoc

### 3. Run Individually (Development)

**Terminal 1 - Backend:**

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install packages
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**

```bash
cd frontend

# Install packages
npm install

# Run development server
npm run dev
```

**Access:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

## 🚀 AWS Deployment

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Docker** installed and running

### Step 1: Setup IAM Roles (First Time Only)

```bash
# Setup IAM roles for Elastic Beanstalk
./setup-iam.sh
```

### Step 2: Deploy to AWS

```bash
# Deploy to AWS Elastic Beanstalk (Tokyo region)
./deploy.sh
```

This script will:
1. Build Docker images for backend and frontend
2. Push images to AWS ECR (Elastic Container Registry)
3. Package the application with Dockerfile
4. Deploy to Elastic Beanstalk environment

**Note:** First deployment may take 10-15 minutes.

### Step 3: Access Deployed Application

After deployment completes, get your application URL:

```bash
aws elasticbeanstalk describe-environments \
  --application-name pdf-template-engine \
  --environment-names pdf-template-prod \
  --region ap-northeast-1 \
  --query 'Environments[0].CNAME' \
  --output text
```

Access your application at: `http://<your-cname>.elasticbeanstalk.com`

## 📖 Usage

### 1. Upload Template

1. Access the application in your web browser (http://localhost for Docker, http://localhost:3000 for dev)
2. Register or login to your account
3. Click "Upload PDF Template" button
4. Select A4 PDF template file

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
│   ├── fonts/              # Font files (NotoSansJP, NotoSansKR)
│   └── requirements.txt    # Python package dependencies
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth)
│   │   └── i18n/           # Internationalization
│   ├── nginx.conf          # Nginx configuration
│   ├── package.json        # Node.js package dependencies
│   └── vite.config.js      # Vite configuration
│
├── .ebextensions/          # Elastic Beanstalk configuration
│   ├── 01_nginx.config     # Nginx configuration
│   └── 02_storage.config   # Storage configuration
│
├── Dockerfile              # Combined Dockerfile for production
├── docker-compose.yml      # Docker Compose configuration
├── deploy.sh               # AWS deployment script
├── setup-iam.sh            # IAM roles setup script
└── README.md               # This file
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

## 🐛 Troubleshooting

### Docker Issues

```bash
# Check Docker is running
docker ps

# View container logs
docker-compose logs -f

# Restart containers
docker-compose restart

# Rebuild containers
docker-compose up -d --build
```

### Port Already in Use

```bash
# Check ports
lsof -ti:8000  # Backend
lsof -ti:80    # Frontend (Docker)
lsof -ti:3000  # Frontend (Dev mode)

# Kill processes
kill -9 $(lsof -ti:8000)
kill -9 $(lsof -ti:80)
kill -9 $(lsof -ti:3000)
```

### AWS Deployment Issues

```bash
# Check deployment status
aws elasticbeanstalk describe-environments \
  --application-name pdf-template-engine \
  --environment-names pdf-template-prod \
  --region ap-northeast-1

# View deployment logs
aws elasticbeanstalk request-environment-info \
  --application-name pdf-template-engine \
  --environment-name pdf-template-prod \
  --info-type tail \
  --region ap-northeast-1
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
