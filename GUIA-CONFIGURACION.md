# Guía de Configuración y Despliegue de Bi-guay-Di

Esta guía explica de forma clara y sin tecnicismos cómo configurar y usar la aplicación para tu **BYD Dolphin Surf**.

---

## 1. ¿Cómo funciona la arquitectura?

1. **La PWA (Frontend):** 
   - Es la web app que abres en tu navegador o instalas en la pantalla de inicio de tu móvil como aplicación nativa.
   - Es **100% gratuita** y se puede alojar sin coste en GitHub Pages.
   - Trabaja de forma autónoma: calcula consumos, compara precios de luz y gasolina, y guarda tus ajustes en tu propio dispositivo.

2. **La Bóveda de Cifrado Local (Seguridad y Privacidad):**
   - En lugar de enviar tu usuario y contraseña a servidores externos desconocidos o pagar por Cloud KMS de Google Cloud, la app cuenta con una **Bóveda AES-256-GCM** integrada en tu navegador (`crypto-vault.js`).
   - Eliges un **PIN personal de 4 a 8 dígitos**. Con ese PIN, las credenciales de tu coche se cifran matemáticamente antes de guardarse en el almacenamiento local de tu teléfono.
   - Ni GitHub ni terceros pueden leer tu clave sin tu PIN.

3. **El Conector BYD (`pyBYD`):**
   - Para descargar la telemetría viva (batería exacta, odómetro, etc.), se utiliza un micro-servicio en Python que consulta la nube oficial de BYD.
   - Se puede ejecutar localmente en tu ordenador cuando quieras sincronizar o en un backend gratuito (como Render o Fly.io en sus planes Free).

---

## 2. Pasos para usar la PWA en tu móvil

### A. Abrir la App localmente en tu ordenador
Si quieres probarla ahora mismo en tu equipo:
1. Abre un terminal en esta carpeta.
2. Ejecuta:
   ```bash
   python -m http.server 8080
   ```
3. Abre en tu navegador (Chrome, Edge o Safari): `http://localhost:8080`

### B. Instalarla como App en tu teléfono móvil (PWA)
1. Puedes subir el proyecto a tu repositorio de **GitHub** y activar **GitHub Pages** (gratuito).
2. Abre la URL en el navegador de tu móvil (por ejemplo `https://tu-usuario.github.io/bi-guay-di`).
3. Pulsa el botón de opciones del navegador (o "Compartir" en iOS Safari) y selecciona **"Añadir a la pantalla de inicio"** / **"Instalar aplicación"**.
4. ¡Listo! Se abrirá a pantalla completa como una app nativa, con su icono del Dolphin Surf y funcionando incluso sin conexión.

---

## 3. Configurar tus tarifas y cálculos

En la pestaña **⚡ Ahorro**:
1. **Elige tu fuente de energía:**
   - **100% Solar:** Si cargas con tus placas fotovoltaicas (coste 0,00 €/kWh).
   - **Mixta:** Si cargas parte de día con solar y parte de noche con red. Puedes ajustar el porcentaje (ej. 80% solar).
   - **Red Eléctrica:** Si cargas siempre de la red convencional.
2. **Ajusta tus precios:**
   - Introduce tu precio real del kWh (ej. `0.15 €/kWh`).
   - Introduce el precio de referencia de la Gasolina 95 (ej. `1.62 €/L`) y el consumo del coche de combustión equivalente (ej. `6.2 L/100km`).
3. La aplicación actualizará automáticamente:
   - Coste de hacer 100 km con tu Dolphin Surf vs Gasolina 95.
   - Ahorro mensual estimado.
   - Huella de CO₂ evitada y árboles equivalentes.

---

## 4. Estructura de las pestañas

* **📊 Resumen (Dashboard):** HUD futurista con indicador circular de batería (SoC), autonomía restante en km, odómetro y tarjeta del Dolphin Surf en el color seleccionado.
* **⚡ Ahorro (Calculadora):** Comparativa dinámica de costes con gráfico interactivo de barras.
* **🚗 Coche (Telemetría):** Lecturas técnicas detalladas: potencia en kW, marcha, salud de batería (SoH), voltajes de 348V y 12V, y presiones de las 4 ruedas en bar.
* **⏱️ Viajes (Historial):** Desglose tramo a tramo con el coste exacto en electricidad y el dinero ahorrado frente a la gasolina.
* **⚙️ Ajustes & Bóveda:** Selección del color real del Dolphin Surf (Verde Lima, Azul, Rojo, Verde Esmeralda, Violeta), ajuste del tamaño de letra y configuración del PIN de la bóveda de cifrado.
