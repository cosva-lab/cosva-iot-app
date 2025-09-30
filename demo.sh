#!/bin/bash

# Cosva IoT Smart Farm - Script de Demostración
# Este script muestra cómo usar el sistema completo

echo "🐄 Cosva IoT Smart Farm - Demostración"
echo "======================================"
echo ""

# Función para mostrar el menú
show_menu() {
    echo "Selecciona una opción:"
    echo "1. Ver estado del sistema"
    echo "2. Iniciar simulador de sensores"
    echo "3. Ver logs del dashboard"
    echo "4. Abrir dashboard en el navegador"
    echo "5. Ver estado de contenedores"
    echo "6. Cargar datos demo"
    echo "7. Limpiar datos demo"
    echo "8. Salir"
    echo ""
}

# Función para verificar si los servicios están corriendo
check_services() {
    echo "🔍 Verificando servicios..."
    if docker ps | grep -q "cosva-dashboard-service"; then
        echo "✅ Dashboard service: Corriendo"
    else
        echo "❌ Dashboard service: No está corriendo"
    fi
    
    if docker ps | grep -q "cosva-postgres-dev"; then
        echo "✅ PostgreSQL: Corriendo"
    else
        echo "❌ PostgreSQL: No está corriendo"
    fi
    
    if docker ps | grep -q "cosva-mosquitto-dev"; then
        echo "✅ MQTT Broker: Corriendo"
    else
        echo "❌ MQTT Broker: No está corriendo"
    fi
    echo ""
}

# Función para mostrar estado del sistema
show_system_status() {
    echo "📊 Estado del Sistema:"
    echo "====================="
    node demo/scripts/demo-status.js
    echo ""
}

# Función para iniciar simulador
start_simulator() {
    echo "🎬 Iniciando simulador de sensores..."
    echo "Presiona Ctrl+C para detener el simulador"
    echo ""
    node demo/scripts/simulate-sensor-data.js
}

# Función para ver logs
show_logs() {
    echo "📋 Logs del Dashboard Service:"
    echo "=============================="
    docker logs cosva-dashboard-service --tail 20
    echo ""
}

# Función para abrir dashboard
open_dashboard() {
    echo "🌐 Abriendo dashboard..."
    if command -v open &> /dev/null; then
        open http://localhost:3000
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    else
        echo "Por favor abre manualmente: http://localhost:3000"
    fi
    echo ""
}

# Función para ver estado de contenedores
show_containers() {
    echo "🐳 Estado de Contenedores:"
    echo "=========================="
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

# Función para limpiar datos demo
clean_demo_data() {
    echo "🧹 Limpiando datos demo..."
    node demo/scripts/demoData/clear.js
    echo ""
    echo "✅ Datos demo eliminados"
    echo "ℹ️  NOTA: Los puestos se definen en config.yml, no se eliminan de la base de datos"
    echo ""
}

# Función para cargar datos demo
load_demo_data() {
    echo "📊 Cargando datos demo..."
    node demo/scripts/demoData/load.js
    echo "✅ Datos demo cargados"
    echo ""
}

# Bucle principal
while true; do
    show_menu
    read -p "Opción: " choice
    echo ""
    
    case $choice in
        1)
            show_system_status
            ;;
        2)
            start_simulator
            ;;
        3)
            show_logs
            ;;
        4)
            open_dashboard
            ;;
        5)
            show_containers
            ;;
        6)
            load_demo_data
            ;;
        7)
            clean_demo_data
            ;;
        8)
            echo "👋 ¡Hasta luego!"
            exit 0
            ;;
        *)
            echo "❌ Opción inválida. Por favor selecciona 1-8."
            echo ""
            ;;
    esac
    
    read -p "Presiona Enter para continuar..."
    echo ""
done
