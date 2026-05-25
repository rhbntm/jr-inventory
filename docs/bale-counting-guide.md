# Bale Counting Guide — J&R Inventory

A step-by-step reference for the owner on how to receive a new ukay/RTW bale and record it in the system.

---

## Overview

Every time you receive a new bale from a supplier, you should create a **Batch** in the system. The wizard walks you through five steps:

1. **Batch Details** – Record supplier, date, and cost
2. **Weighing** – Estimate total quantity from a sample weigh
3. **Damages** – Count and record damaged/unsellable items
4. **Assign Variants** – Split the batch across product variants
5. **Confirm** – Review everything and press Save

---

## Step 1 – Batch Details

Fill in what you know before opening the bale:

| Field | Description | Example |
|---|---|---|
| Supplier Name | Who you bought from | *Divisoria Wholesale* |
| Purchase Date | Date you received it | *2026-05-24* |
| Total Cost (₱) | What you paid for the full bale | *₱8,500* |
| Category | General type of clothing | *Ukay-ukay*, *RTW*, *Kids* |
| Notes | Any free-text notes | *Mix of T-shirts and shorts* |

---

## Step 2 – Weighing Procedure

This step estimates the total number of pieces without counting every item by hand.

### What you need
- A kitchen or postal scale
- The full bale (still packed is fine)

### Procedure

1. **Pull out a sample** — grab exactly 10 random items from the bale.
2. **Weigh the sample** — record the weight in kg (e.g., `1.4 kg`).
3. **Weigh the full bale** — record total weight in kg (e.g., `42 kg`).
4. Enter the three numbers in the wizard and click **Calculate Estimate**.

### Formula used

```
Weight per unit = Sample Weight ÷ Sample Count
Estimated Total = floor(Total Weight ÷ Weight per Unit)
```

> **Example:** 10 items weigh 1.4 kg → 0.14 kg/item.  
> Full bale = 42 kg → floor(42 ÷ 0.14) = **300 items estimated**

### Tips for accuracy
- Use a larger sample (20–30 items) for mixed-weight bales like kids + adults.
- Exclude any heavy non-clothing items (belts, bags) from the sample.
- Re-weigh the bale without packaging for the most accurate result.

---

## Step 3 – Recording Damages

After opening and spreading the bale:

1. Set aside items that are **torn, stained, mouldy, or completely unsellable**.
2. Count them and enter the number in the **Damaged / Unsellable Count** field.
3. The system shows you the usable quantity (Estimated − Damaged).

### Best practices
- Never discard damaged items immediately — some may be repairable.
- Grade damages: **Minor** (small stain, loose button) vs **Major** (torn, unusable).
- For items you'll sell at a deeper discount, consider creating a separate "Damaged" product variant.

---

## Step 4 – Assigning to Variants

This is where you split the batch across your existing product variants.

1. **Search** for a product or SKU.
2. Click **Add** to include a variant.
3. Enter the **Quantity** for that variant (how many pieces fit that category).
4. Optionally override the **Cost per Unit** — leave blank to auto-calculate from total batch cost.

> **Auto cost formula:** `Cost per Unit = Total Batch Cost ÷ Total Assigned Quantity`

### Example split for a 300-piece bale

| Variant | Qty |
|---|---|
| T-Shirt / Medium / Black | 80 |
| T-Shirt / Large / White | 60 |
| Shorts / Free Size / Navy | 100 |
| Polo / XL / Grey | 60 |

---

## Step 5 – Confirm & Save

Review all the information before pressing **Confirm & Save**. When you submit:

- A **Batch** record is saved with all the header info
- A **StockMovement (IN)** is created for every variant with quantity > 0
- Each variant's **current stock** is incremented automatically
- The batch appears in the **Dashboard** analytics (Profit & Damage rate)

---

## Dashboard Analytics

After processing batches, the dashboard shows:

- **Top Batches by Profit** — ranked by estimated revenue minus purchase cost
- **Highest Damage Rate** — batches with the worst damage percentage (alerts if > 20%)

Use the damage rates to decide which suppliers to avoid or negotiate better pricing with.

---

## Frequently Asked Questions

**Q: Can I edit a batch after saving?**  
A: Not through the wizard — currently batches are write-once. Contact your developer to make corrections directly via Prisma Studio.

**Q: What if I don't know the exact cost yet?**  
A: Leave the Total Cost blank. You can still assign variants and save. Cost per unit will show as ₱0 until updated.

**Q: How do I handle items I sort into new product variants?**  
A: Create the new variant first in *Products*, then come back to the Batch wizard.

**Q: Is the Estimated Qty always accurate?**  
A: No — it's a floor estimate based on average weight per item. A mixed bale with very different item weights (e.g., jackets + baby shirts) will have more variance. Always recount high-value items.
