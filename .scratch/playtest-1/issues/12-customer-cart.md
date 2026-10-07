# Design the Customer's shopping cart

Type: prototype
Status: resolved
Assignee: Seif (claimed 2026-10-07)
Blocked by: 02, 09

## Question

What does a Customer's cart look like, and how do Items stack in it: vertically and wobbly, like the Player's Stack? How does it move through Queue Spots and the Register, and what happens to it in a Mess?

## Context

Note #10. The glossary already says Customers take Items "into a cart", but no cart is drawn today. Item size comes from [Make Items and Producer output readable](09-item-and-output-readability.md). The biggest list sizes come from [Decide Customer demand](02-customer-demand.md). Watch the draw-call budget: up to 15 Customers on phones.

From [Pick Shelf and Register models](10-shelf-and-register-models.md): at checkout the cart's Items leave it and ride the Register's conveyor belt to a bagging tray, so the cart empties at the Register.

## Answer

Resolved 2026-10-07 (prototype; the owner picked preset **B, "Hand basket"**, asked for a stronger wobble and for only some Customers to take one, then tuned and pasted the values). Prototype: branch `prototype/customer-cart` (`src/app/cart-prototype.ts`, `src/view/proto-cart.ts`, `?cart=B` on a dev build; it carries the C Shelves, the checkout belt and the new demand rules).

```json
{
  "variant": "B",
  "itemScale": 0.6,
  "towerGap": 0.6,
  "wobble": 2.2,
  "basketHeight": 0.4,
  "cartChance": 0.6,
  "sway": 0.55,
  "swaySpeed": 2.2
}
```

(The pasted dump showed `"variant": "A"`, a prototype display bug; the owner was on preset B.)

**No wheeled cart.** The glossary's "cart" is the Customer's Items, whatever carries them.

- **60% of Customers take a hand basket**, rolled once per Customer when they arrive, whatever the Shopping List size. The other 40% carry their Items stacked on their hands, like today (Stack at ×0.7).
- **Basket:** Kenney Mini Market `shopping-basket`, 0.4 m tall, held in the right hand (0.38 m to the side, 0.15 m ahead, 0.42 m up).
- **Items in it** at ×0.6 Item size: the first 2 sit inside the basket; the rest stack up out of it as a **wobbly tower** (spacing 0.6 × Item size).
- **Wobble:** the tower uses the Stack's walking lean ×2.2, plus a constant **idle sway** (amplitude 0.55, speed 2.2, phase-shifted per Customer) so it wobbles even standing still; each Item tilts with the lean (up to the 6th).
- **Checkout:** Items leave the basket (or hands) onto the Register belt ([Pick Shelf and Register models](10-shelf-and-register-models.md)); the Customer leaves with the empty basket.
- **Mess:** an angry Customer's basket **tips over** and its Items spill out as the Mess; the empty basket lies there briefly, then fades. Customers without a basket drop their Stack as today.
- **Performance:** baskets are drawn as one instanced model (≤ 15 Customers = no extra draw calls per Customer).
