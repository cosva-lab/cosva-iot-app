-- Datos demo para Cosva IoT Smart Farm
-- Este script inserta datos de ejemplo para probar el sistema
-- NOTA: Los stalls se definen en config.yml, no en la base de datos

-- Limpiar datos existentes (opcional)
-- DELETE FROM presences;
-- DELETE FROM detections;
-- DELETE FROM cows;

-- Insertar vacas de ejemplo
INSERT INTO cows (id, farm_token, name, tag_number, breed, birth_date, status, created_at, updated_at) VALUES
('cow-001', 'farm-001', 'Bella', 'RFID123456789', 'Holstein', '2020-03-15', 'active', NOW(), NOW()),
('cow-002', 'farm-001', 'Luna', 'RFID987654321', 'Jersey', '2019-11-22', 'active', NOW(), NOW()),
('cow-003', 'farm-001', 'Stella', 'RFID456789123', 'Holstein', '2021-07-08', 'active', NOW(), NOW()),
('cow-004', 'farm-001', 'Daisy', 'RFID789123456', 'Angus', '2020-12-03', 'active', NOW(), NOW()),
('cow-005', 'farm-001', 'Molly', 'RFID321654987', 'Jersey', '2021-01-18', 'active', NOW(), NOW()),
('cow-006', 'farm-001', 'Ruby', 'RFID654987321', 'Holstein', '2019-05-12', 'active', NOW(), NOW());

-- Insertar estados de presencia actuales
INSERT INTO presences (id, sensor_token, cow_id, status, timestamp, duration, created_at) VALUES
('pres-001', 'RFID01', 'cow-001', 'STILL_PRESENT', '2024-09-23 08:30:00', 1800, NOW()),
('pres-002', 'RFID02', 'cow-002', 'STILL_PRESENT', '2024-09-23 09:15:00', 1200, NOW()),
('pres-003', 'RFID04', 'cow-003', 'STILL_PRESENT', '2024-09-23 07:45:00', 2100, NOW()),
('pres-004', 'RFID06', 'cow-004', 'STILL_PRESENT', '2024-09-23 10:20:00', 900, NOW()),
('pres-005', 'RFID03', 'cow-005', 'LEFT', '2024-09-23 06:30:00', 3600, NOW()),
('pres-006', 'RFID05', 'cow-006', 'LEFT', '2024-09-23 11:00:00', 1800, NOW()),
-- Eventos históricos de entrada
('pres-007', 'RFID01', 'cow-001', 'ENTERED', '2024-09-23 08:00:00', 0, NOW()),
('pres-008', 'RFID02', 'cow-002', 'ENTERED', '2024-09-23 09:00:00', 0, NOW()),
('pres-009', 'RFID04', 'cow-003', 'ENTERED', '2024-09-23 07:30:00', 0, NOW()),
('pres-010', 'RFID06', 'cow-004', 'ENTERED', '2024-09-23 10:00:00', 0, NOW()),
('pres-011', 'RFID03', 'cow-005', 'ENTERED', '2024-09-23 06:00:00', 0, NOW()),
('pres-012', 'RFID05', 'cow-006', 'ENTERED', '2024-09-23 10:30:00', 0, NOW());

-- Mostrar resumen de datos insertados
SELECT 'Cows' as table_name, COUNT(*) as count FROM cows
UNION ALL
SELECT 'Detections', COUNT(*) FROM detections
UNION ALL
SELECT 'Presences', COUNT(*) FROM presences;