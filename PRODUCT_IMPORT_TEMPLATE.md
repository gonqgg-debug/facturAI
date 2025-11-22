# Product Catalog Import Template

Use this template to import your product catalog into the Pricing Module.

## Supported Columns

### Required (at least one):
- **ProductID** / **SKU** / **Codigo** / **ID** - Your unique product identifier
- **Name** / **Product Name** / **Producto** - Product name

### Optional:
- **Supplier** / **Suplidor** - Supplier name
- **Cost** / **Costo** / **Last Cost** - Most recent purchase cost
- **AverageCost** / **Average Cost** / **Costo Promedio** - Average cost over time
- **Price** / **Precio** / **Selling Price** - Current selling price
- **Category** / **Categoria** - Product category
- **TargetMargin** / **Margen** / **Target Margin** - Target profit margin (0.30 = 30%)
- **SalesVolume** / **Sales Volume** / **Cantidad Vendida** - Total units sold

## Excel Template Format

| ProductID | Name           | Supplier        | Cost  | AverageCost | Price | Category | TargetMargin | SalesVolume |
|-----------|----------------|-----------------|-------|-------------|-------|----------|--------------|-------------|
| SKU001    | Presidente Beer| Cerveceria      | 50.00 | 48.50       | 75.00 | Fria     | 0.33         | 120         |
| SKU002    | Arroz Rico     | Distribuidora A | 25.00 | 24.00       | 35.00 | Surtido  | 0.28         | 85          |
| SKU003    | Doritos        | Snacks Inc      | 15.00 | 15.50       | 30.00 | Antojos  | 0.50         | 200         |

## Import Behavior

### Matching Logic:
1. If **ProductID** is provided, the system will match by ProductID first
2. If no ProductID match, it will try to match by **Name** (case-insensitive)
3. If no match is found, a new product will be created

### Update vs Create:
- **Existing products** (matched by ProductID or Name) will be **updated** with new data
- **New products** will be **created** with all provided information
- Suppliers that don't exist will be automatically created

### Cost Handling:
- **Cost** → Stored as `lastPrice` (most recent purchase cost)
- **AverageCost** → Stored as `averageCost` (average cost over time)
- Both fields are optional and independent

## Tips

1. **ProductID is recommended** - It ensures accurate matching even if product names change
2. **Use consistent naming** - Supplier names should match across imports
3. **Decimal format** - Use 0.30 for 30% margin (not 30)
4. **Currency** - All prices should be in the same currency (DOP recommended)
5. **Missing data** - Leave cells empty if data is not available (don't use 0 for prices)

## Example Import Result

After import, you'll see a summary:
```
Import Complete!
Created: 15
Updated: 42
Skipped: 2
```

- **Created** - New products added to the system
- **Updated** - Existing products with updated information
- **Skipped** - Rows without Name or ProductID
