Header for a multi-step flow: a 44px "‹ Atrás" button, "Paso 1 de 2" announced through a polite live region, and a segmented progress bar (`aria-hidden`; the text is the announcement). Pass localized `backLabel` / `stepLabel` outside Spanish.

```jsx
<StepHeader step={1} total={2} onBack={goBack} />
<StepHeader step={2} total={2} onBack={goBack} backLabel="Back" stepLabel="Step 2 of 2" />
```
