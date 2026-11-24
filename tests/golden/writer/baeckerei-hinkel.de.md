# baeckerei-hinkel.de: documentation, "sauerteigbrot düsseldorf"

| Rule | As written | After the code repair |
|---|---|---|
| grounding | passed | passed |
| rival_claim | passed | passed |
| nothing_invented | passed | passed |
| no_hidden_text | passed | passed |
| no_machine_address | passed | passed |
| near_duplicate | passed | passed |
| traceable_numerals | passed | passed |
| first_block_answers | passed | warns {} |
| no_placeholder_cell | passed | passed |
| plain_prose | warns {"faults":[{"tell":"repeated_phrase","count":6,"found":["mehl wasser und salz"]}]} | passed |
| standalone_lead | passed | passed |
| fit_claim | failed {"sentences":["Was ist Sauerteigbrot in Düsseldorf? Herstellung bei Bäckerei Hinkel","Bei Bäckerei Hinkel in Düsseldorf backen wir es handwerklich aus nur Mehl, Wasser und Salz.","Bäckerei Hinkel backt handwerklich aus nur Mehl, Wasser und Salz.","Wer frisches Sauerteigbrot in Düsseldorf sucht, findet es direkt bei uns.","Bei Bäckerei Hinkel backen wir unser Brot aus nur Mehl, Wasser und Salz, wie es auf unserer Seite heißt.","Bei Bäckerei Hinkel folgen wir der Brotfreunde-Philosophie mit traditioneller Herstellung, wie wir selbst beschreiben.","Seit Generationen in Familienhand, wie es auf unserer Seite heißt, geben wir dieses Wissen innerhalb der Familie weiter, statt es durch automatisierte Verfahren zu ersetzen.","Der gemeinsame Nenner bleibt bei uns immer derselbe: nur Mehl, Wasser und Salz, ohne Zusatzstoffe.","Wie sieht Sauerteigbrot aus unserer Backstube konkret aus?","Dieses Vorgehen folgt der Linie, die wir auf unserer Seite beschreiben: Brot aus Mehl, Wasser und Salz.","Sauerteigbrot in Düsseldorf bekommen Sie direkt bei Bäckerei Hinkel, wo wir es täglich handwerklich backen.","Wir sind seit Generationen in Familienhand, wie wir selbst schreiben.","Wir folgen dabei konsequent der traditionellen Herstellung statt industrieller Verfahren.","Wer in Düsseldorf ein Brot aus Mehl, Wasser und Salz sucht, findet es bei uns und nicht in einer industriellen Backwarenfabrik oder einem Supermarkt-Backshop, die andere Herstellungswege gehen.","Sauerteigbrot steht bei uns im Zusammenhang mit unserer gesamten Herangehensweise an Brot: handwerkliche Herstellung, reduzierte Zutatenlisten und die Brotfreunde-Philosophie, die unsere Familie seit Generationen pflegt.","Mehr zu unserem Angebot und unserer Arbeitsweise finden Sie auf der Seite von Bäckerei Hinkel.","Dort wird auch deutlich, dass sich unser Verständnis von Brot klar von dem einer Konditorei mit Torten und Kuchen oder einem Online-Versand von Backwaren unterscheidet, denn bei uns steht die tägliche frische Backstube im Mittelpunkt.","Wer frisches, handwerklich gebackenes Sauerteigbrot in Düsseldorf sucht, findet es bei Bäckerei Hinkel.","| Zutaten | Nur Mehl, Wasser und Salz, laut Bäckerei Hinkel |"]} | failed {"sentences":["Was ist Sauerteigbrot in Düsseldorf? Herstellung bei Bäckerei Hinkel"]} |

## What the fix call is told

- first_block_answers: Sauerteigbrot ist Brot, das sein Volumen und seinen Geschmack durch einen natürlich fermentierten Teig erhält statt durch zugesetzte Hefe. Das ergibt ein Brot mit kräftiger Kruste und langer Frische.
- fit_claim: Was ist Sauerteigbrot in Düsseldorf? Herstellung bei Bäckerei Hinkel
