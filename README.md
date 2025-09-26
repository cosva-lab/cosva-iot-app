# COSVA IoT Smart Farm System

Un sistema IoT completo para granjas lecheras inteligentes con arquitectura de microservicios, basado en Node.js y tecnologías containerizadas.

## 🚀 Características Principales

- **Arquitectura de Microservicios**: Servicios modulares para sensores, sincronización y dashboard
- **Comunicación MQTT**: Broker Mosquitto para comunicación en tiempo real
- **Base de Datos Relacional**: PostgreSQL con Prisma ORM
- **Caché Redis**: Para manejo de sesiones y optimización de rendimiento
- **Proxy Nginx**: Balanceador de carga y proxy reverso
- **Contenedorización**: Docker y Docker Compose para despliegue
- **Monorepo**: Gestión centralizada con Turbo y npm workspaces

## 📋 Requisitos del Sistema

- **Node.js**: >= 18.0.0
- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **npm**: >= 10.9.2

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Sensor Service │    │   Sync Service  │    │Dashboard Service│
│                 │    │                 │    │                 │
│ RFID Sensors    │    │ API Integration │    │ Web Interface   │
│ Presence Detection│  │ Data Sync       │    │ Real-time Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  MQTT Broker    │
                    │  (Mosquitto)    │
                    └─────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   PostgreSQL    │ │     Redis       │ │     Nginx       │
    │   Database      │ │     Cache       │ │ Reverse Proxy   │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🚀 Inicio Rápido

### 1. Clonar el Repositorio

```bash
git clone https://github.com/cosva-lab/cosva-iot-app.git
cd cosva-iot-app
```

### 2. Configurar Variables de Entorno

```bash
cp env.example .env
```

Edita el archivo `.env` con tus configuraciones específicas:

```env
# Base de Datos
DB_NAME=cosva_iot
DB_USERNAME=cosva_user
DB_PASSWORD=cosva_password
DB_PORT=5433

# MQTT
MQTT_USERNAME=cosva_service
MQTT_PASSWORD=cosva123
MQTT_PORT=1884
MQTT_WS_PORT=9002

# Redis
REDIS_PASSWORD=cosva_redis_password
REDIS_PORT=6381

# API Externa
API_BASE_URL=https://api.cosva.com
API_KEY=your-api-key-here

# Servicios
DASHBOARD_SERVICE_PORT=3000
NODE_ENV=production
```

### 3. Configurar Acceso a Paquetes Privados

Este proyecto utiliza paquetes privados de la organización Cosva Lab alojados en GitHub Packages. Necesitas configurar el acceso:

```bash
cp .npmrc.example .npmrc
```

Edita el archivo `.npmrc` y reemplaza el token de ejemplo con tu token personal de GitHub:

```bash
registry=https://registry.npmjs.org

# Cosva Lab organization
@cosva-lab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=TU_GITHUB_TOKEN_AQUI
```

#### Generar Token de GitHub

1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Genera un nuevo token con permisos `read:packages`
3. Copia el token y reemplázalo en `.npmrc`

**⚠️ Importante**: 
- No compartas tu token de GitHub
- El archivo `.npmrc` está en `.gitignore` para evitar commits accidentales
- Cada desarrollador debe configurar su propio token

### 4. Instalar Dependencias

```bash
npm run install:all
```

### 4. Generar Cliente Prisma

```bash
npm run db:generate
```

## 🐳 Despliegue con Docker

### Modo Desarrollo (Solo Infraestructura)

Para desarrollo local, ejecuta solo la infraestructura (base de datos, MQTT, Redis, Nginx):

```bash
npm run docker:up
```

Los servicios de aplicación se ejecutan localmente:

```bash
npm start
```

### Modo Producción (Sistema Completo)

Para desplegar el sistema completo en producción:

```bash
npm run docker:prod
```

Para detener:

```bash
npm run docker:prod:down
```

## 🔧 Scripts Disponibles

### Desarrollo
- `npm start` - Ejecuta todos los servicios en paralelo
- `npm run docker:up` - Levanta infraestructura en Docker
- `npm run docker:down` - Detiene infraestructura

### Producción
- `npm run docker:prod` - Despliega sistema completo
- `npm run docker:prod:down` - Detiene sistema completo

### Base de Datos
- `npm run db:generate` - Genera cliente Prisma
- `npm run db:migrate` - Ejecuta migraciones
- `npm run db:seed` - Siembra datos de prueba

### Utilidades
- `npm run build:shared` - Construye imagen base compartida
- `npm run docker:clean` - Limpia contenedores y volúmenes
- `npm run clean` - Limpia node_modules
- `npm run install:all` - Instala todas las dependencias

## 📊 Servicios

### 🔬 Sensor Service
- **Puerto**: Variable (interno)
- **Función**: Maneja sensores RFID y detección de presencia
- **Tecnologías**: Node.js, Serial Communication
- **Package**: `@cosva-lab/iot-sensor`

### 🔄 Sync Service  
- **Puerto**: Variable (interno)
- **Función**: Sincroniza datos con API externa de COSVA
- **Tecnologías**: Node.js, HTTP API Integration
- **Reintentos**: 3 intentos automáticos

### 📈 Dashboard Service
- **Puerto**: 3000 (configurable)
- **Función**: Interfaz web para monitoreo y control
- **Tecnologías**: Node.js, Web Interface
- **Package**: `@cosva-lab/iot-dashboard`

## 🗄️ Infraestructura

### 🐘 PostgreSQL
- **Puerto**: 5433 (externo) / 5432 (interno)
- **Base de Datos**: cosva_iot
- **Health Check**: Configurado
- **Persistencia**: Volumen Docker

### 🦟 Mosquitto MQTT
- **Puerto MQTT**: 1884 (externo) / 1883 (interno)
- **Puerto WebSocket**: 9002 (externo) / 9001 (interno)
- **Autenticación**: Usuario/contraseña configurables
- **Persistencia**: Volúmenes para config, data y logs

### 🟥 Redis
- **Puerto**: 6381 (externo) / 6379 (interno)
- **Función**: Caché y manejo de sesiones
- **Persistencia**: AOF habilitado

### 🌐 Nginx
- **Puerto HTTP**: 80
- **Puerto HTTPS**: 443
- **Función**: Proxy reverso y balanceador de carga
- **SSL**: Soporte para certificados personalizados

## ⚙️ Configuración

### config.yml
El archivo `config.yml` contiene la configuración estática de la granja:

```yaml
farm:
  id: 'farm-001'
  name: 'Main Dairy Farm'

stalls:
  - id: 'stall-001'
    number: 1
    sensor_id: 'RFID01'
    status: 'available'
  # ... más establos
```

### Variables de Entorno
Las configuraciones dinámicas se manejan via variables de entorno:

- **BASE_URL**: URL base de la API
- **DATABASE_URL**: Cadena de conexión PostgreSQL
- **MQTT_***: Configuraciones del broker MQTT
- **LOG_LEVEL**: Nivel de logging (DEBUG, INFO, WARN, ERROR)

## 🔍 Monitoreo y Logs

### Health Checks
- PostgreSQL tiene health check automático
- Servicios configurados con restart: unless-stopped

### Logs
Los logs se almacenan en:
- Mosquitto: `./broker/mosquitto/log/`
- Docker containers: `docker logs <container-name>`

### Comandos Útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f sensor-service

# Ver estado de contenedores
docker-compose ps

# Reiniciar un servicio
docker-compose restart sensor-service
```

## 🛠️ Desarrollo

### Estructura del Proyecto

```
cosva-iot-app/
├── services/                 # Microservicios
│   ├── sensor/              # Servicio de sensores
│   ├── sync/                # Servicio de sincronización
│   └── dashboard/           # Servicio de dashboard
├── broker/                  # Configuración de brokers
│   ├── mosquitto/          # MQTT broker config
│   └── nginx/              # Nginx config
├── scripts/                # Scripts de utilidad
├── config.yml             # Configuración de granja
├── docker-compose.yml     # Orquestación Docker
└── package.json           # Configuración raíz
```

### Agregar Nuevos Sensores

1. Edita `config.yml` para agregar el nuevo stall
2. Asegúrate de que el sensor tenga un `sensor_id` único
3. Reinicia el sensor service

### Desarrollo Local

Para desarrollo, puedes ejecutar servicios individualmente:

```bash
# Solo infraestructura
npm run docker:up

# En terminales separadas
cd services/sensor && npm start
cd services/sync && npm start  
cd services/dashboard && npm start
```

## 🔒 Seguridad

- **Autenticación MQTT**: Usuario/contraseña requeridos
- **Red Aislada**: Todos los servicios en red Docker privada
- **Configuración SSL**: Nginx configurado para HTTPS
- **Variables de Entorno**: Secretos manejados via .env

## 🚨 Solución de Problemas

### Base de Datos no Conecta
```bash
# Verificar estado de PostgreSQL
docker-compose logs postgres

# Reiniciar base de datos
docker-compose restart postgres
```

### MQTT Broker no Responde
```bash
# Verificar configuración Mosquitto
docker-compose logs mosquitto

# Verificar puertos
netstat -an | grep 1884
```

### Servicio no Inicia
```bash
# Verificar logs del servicio
docker-compose logs <service-name>

# Verificar variables de entorno
docker-compose config
```

### Limpiar Sistema Completo
```bash
npm run docker:clean
npm run clean
npm run install:all
```

## 📞 Soporte

Para soporte técnico:
- **Documentación**: Este README
- **Issues**: Reportar en el repositorio
- **Logs**: Incluir logs relevantes en reportes

## 📄 Licencia

Este proyecto es propietario de COSVA Lab.

---

**COSVA IoT Smart Farm System** - Tecnología avanzada para granjas del futuro 🐄🚀