Whole-card choice for a fork screen ("how do you want to start?"). The card is ONE `<button>`; its accessible name is badge + title + CTA label. Use `recommended` for the single suggested option (purple border, tint, badge, filled CTA look) and the default variant for the alternative (outline look).

```jsx
<ChoiceCard recommended badge="Recomendado" title="Prepara un prompt para tu IA"
  body="Responde unas preguntas y te damos un prompt listo." meta="~3 min"
  ctaLabel="Preparar prompt" onSelect={prepare} />
<ChoiceCard title="Ya tengo un rutina.json" body="Pega el JSON o elige un archivo."
  ctaLabel="Importar" onSelect={importJson} />
```
