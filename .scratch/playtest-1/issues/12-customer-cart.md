# Design the Customer's shopping cart

Type: prototype
Status: open
Blocked by: 02, 09

## Question

What does a Customer's cart look like, and how do Items stack in it: vertically and wobbly, like the Player's Stack? How does it move through Queue Spots and the Register, and what happens to it in a Mess?

## Context

Note #10. The glossary already says Customers take Items "into a cart", but no cart is drawn today. Item size comes from [Make Items and Producer output readable](09-item-and-output-readability.md). The biggest list sizes come from [Decide Customer demand](02-customer-demand.md). Watch the draw-call budget: up to 15 Customers on phones.

From [Pick Shelf and Register models](10-shelf-and-register-models.md): at checkout the cart's Items leave it and ride the Register's conveyor belt to a bagging tray, so the cart empties at the Register.
