# 5Alive

Selainpohjainen 5Alive-korttipeli 2-6 pelaajalle. Peli on suunniteltu
paikalliseen vuoropeliin erityisesti iPadin vaakanäytöllä ja PC:llä.

Peli toimii asennettavana PWA-sovelluksena ja latautuu ensimmäisen
verkkokäynnin jälkeen myös ilman verkkoyhteyttä.

## Pelaaminen

Julkaistu peli: https://ymouse91.github.io/fivealive/

Paikallisesti pelin voi käynnistää esimerkiksi komennolla:

```powershell
python -m http.server 8877
```

Sen jälkeen peli avautuu osoitteessa http://localhost:8877/.

## Testit

Selain- ja PWA-testit käyttävät Playwrightia. Projektissa ovat testit
pelin perustoiminnoille, korttien tekstien mahtumiselle, iPad-asettelulle,
Käännös-kortin vuorojärjestykselle, pelin tallennukselle, reunatapauksille
ja offline-käytölle.
