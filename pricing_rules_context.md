# Estrategia de Precios - Minimarket Zona Turística (RD)

Este instructivo guía a la IA en el análisis de productos para sugerir precios óptimos que maximicen márgenes, considerando competencia local (Jumbo, Sirena), estacionalidad y reglas de negocio.

## 1. Reglas Fundamentales

*   **Redondeo Estricto**: Precios finales SIEMPRE en múltiplos de **5 o 0** (ej. 102.3 → 105). Priorizar redondeo hacia arriba.
*   **Márgenes Meta (Gross Margin)**:
    *   🍺 **Alcohol/Snacks (Antojos)**: 40-50% (Alta rotación en turismo).
    *   🥫 **Groceries (Surtido)**: 25-35% (Sensible a precio).
    *   🥦 **Perecederos**: 20-30% (Rotación rápida para evitar mermas).
*   **ITBIS**: Asegurar que el precio cubra el 18% de ITBIS en productos gravados.

## 2. Análisis de Factores

### 🏖️ Estacionalidad
*   **Alta Temporada (Dic-Mar, Jun-Ago)**:
    *   Estrategia: **Subir 10-15%** en bebidas, agua y snacks.
    *   Enfoque: Conveniencia. El turista paga por cercanía.
*   **Baja Temporada (Abr-May, Sep-Nov)**:
    *   Estrategia: **Bajar 5-10%** para atraer locales o mantener flujo.
    *   Acción: Crear **Bundles** (Combos) para impulsar ventas.

### 🏢 Competencia (Jumbo/Sirena)
*   **Regla de Proximidad**: Podemos cobrar **10-20% más** que el supermercado por la conveniencia (frío, rápido, cerca).
*   **Límite**: Si nuestro precio es >30% vs competencia, perdemos al cliente. Sugerir rebaja o valor agregado.

### 📊 Históricos de Ventas
*   **Alto Volumen (>50 uds/mes)**: Margen flexible. Si se vende mucho, podemos ganar un poco menos % pero más $ total.
*   **Bajo Volumen**: Sugerir "Idea Creativa" (Bundle, Promo) para mover inventario.

## 3. Lógica de Sugerencia

1.  **Calcular Costo Neto**: Costo Compra + ITBIS + 5% (Logística).
2.  **Aplicar Margen por Categoría**: `Precio = Costo / (1 - Margen%)`.
3.  **Ajuste Estacional**: Aplicar +10% o -5% según fecha actual.
4.  **Redondeo**: Aplicar regla de múltiplos de 5.

### Ejemplo: Cerveza Presidente
*   Costo: RD$200
*   Margen Base (40%): RD$333
*   Alta Temporada (+10%): RD$366
*   **Precio Final Sugerido**: **RD$365** o **RD$370** (Redondeado).

## 4. Output Requerido (Formato JSON)

La IA debe devolver las sugerencias en el siguiente formato JSON (adaptado para el sistema):

*   `suggestedPrice`: El precio final calculado y redondeado.
*   `suggestedMargin`: El margen resultante (decimal, ej. 0.45).
*   `reasoning`: Una explicación concisa que incluya:
    *   Por qué ese precio (ej. "Alta temporada + Margen alcohol").
    *   **Idea Creativa**: Si aplica, sugerir un bundle (ej. "Baja rotación: Sugiero Bundle con Lays por RD$400").
    *   Alertas: (ej. "Margen actual < 25%, urge subir").
