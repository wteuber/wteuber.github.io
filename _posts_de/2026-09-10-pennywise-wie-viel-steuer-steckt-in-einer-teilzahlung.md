---
title: "PennyWise: Wie viel Steuer steckt in einer Teilzahlung?"
subtitle: Wird eine Rechnung mit Steuer in Raten bezahlt, schleicht sich ein Rundungsfehler ein. Eine einzige Idee beseitigt ihn, eine laufende Steuersumme, die nur abgerundet werden darf. Eine Rechnung im Restaurant aufzuteilen ist übrigens dasselbe Problem.
cover-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase-cover-dark.png
thumbnail-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase.png
share-img: /assets/img/2026-09-10-pennywise-how-much-of-a-part-payment-is-tax/staircase-share.png
tags: [algorithms, ruby, mathematics, money, engineering]
author: Wolfgang Teuber
ref: pennywise
---

Pennywise heißt der Clown aus der Kanalisation. Und im Englischen gibt es das alte Sprichwort „penny wise, pound foolish“: beim Kleingeld sparsam, bei großen Summen leichtsinnig. Um beides geht es hier nicht.

Es geht um ein kleines, aber wirklich lästiges Problem. Es taucht auf, sobald jemand eine Rechnung mit Steuer in mehreren Teilen bezahlen darf. Und es geht um ein bisschen Arithmetik, die es verschwinden lässt.

Hier ist das Problem in einem Satz. Eine Rechnung über **10,70** enthält **7 % Steuer**, also 10,00 für die Ware und 0,70 Steuer. Bezahlt wird in drei Raten: 5,00, dann noch einmal 5,00, dann die restlichen 0,70. **Wie viel von jeder Rate war Steuer?**

Die Antwort brauchst du aus handfesten Gründen. Steuer wird nach Fristen abgeführt. Die Buchhaltung muss also wissen, wie viel Steuer mit jeder Zahlung hereingekommen ist, nicht nur die Summe am Ende. Wird die zweite Rate erstattet, musst du genau die Steuer zurückgeben, die darin steckte. Und für jede Rate gibt es einen Beleg, und die Belege müssen zusammen die Rechnung ergeben.

Die naheliegende Antwort ist falsch. Sieben Prozent von 5,00 sind 0,35, und 0,35 + 0,35 + ein bisschen ist schon mehr als 0,70. Das ist keine Rundungskuriosität. Die Steuer wird schlicht auf der falschen Basis berechnet. Die richtige Aufteilung ist **0,32, 0,33, 0,05**. Warum ausgerechnet die mittlere Rate den zusätzlichen Cent trägt, ist die ganze Geschichte.

Ich habe dafür eine kleine Ruby-Bibliothek namens PennyWise geschrieben. Sie macht genau diese Aufteilung und garantiert, dass die Teile aufgehen. Gebaut habe ich sie für Ratenzahlungen, aber die Arithmetik weiß gar nicht, was eine Zahlung ist. Gib ihr statt drei Zahlungen einer Person drei Anteile an einer Restaurantrechnung, und sie teilt die Steuer genauso exakt zwischen den Leuten am Tisch auf. [Eine Rechnung aufzuteilen](#splitting-a-bill-is-the-same-problem) fällt also nebenbei mit ab. Darauf komme ich gegen Ende zurück.

Wenn du lieber mit der Idee spielst, als darüber zu lesen: Ein paar Absätze weiter unten gibt es [eine interaktive Version](#see-the-problem-first). Gib deine eigenen Zahlen ein und sieh zu, wie die übliche Methode abdriftet, während PennyWise exakt bleibt.

## Warum die naive Aufteilung abdriftet

Die Steuer in einer Teilzahlung ist nicht „Zahlung mal Steuersatz“. Ein Bruttobetrag `G`, der die Steuer zum Satz `r` schon enthält, zerfällt so:

```
G = net + net * r = net * (1 + r)
net = G / (1 + r)
tax = G - net = G * r / (1 + r)
```

Für die ganze Rechnung ergibt das `10.70 / 1.07 = 10.00` netto und `0.70` Steuer, wie es sein soll. Für eine einzelne Rate von 5,00 ergibt es `5.00 * 0.07 / 1.07 = 0.3271...`, also etwa 32,7 Cent.

Jetzt runden wir. Rate eins: 33 Cent. Rate zwei: 33 Cent. Rate drei, auf 0,70: `0.70 * 0.07 / 1.07 = 0.0458...`, gerundet 5 Cent. Eingenommene Steuer insgesamt: **71 Cent**. Auf der Rechnung standen 70. Du hast einen Cent erfunden, und deine Bücher gehen nicht mehr auf.

Rundest du anders, zum Beispiel immer ab, verlierst du stattdessen einen Cent. Ändern sich die Raten, ändert sich auch der Fehler. Bei einer Rechnung ist es ein Cent. Bei ein paar hunderttausend Rechnungen ist es ein Support-Ticket, eine Differenz in der Buchhaltung und ein verlorener Nachmittag.

Die Lösung hat drei Teile. Erstens: nicht mehr mit Bruchteilen eines Cents rechnen. Zweitens: die Steuer einmal herausrechnen statt bei jeder Zahlung. Drittens: die Cents nach einer Regel verteilen, die nicht abdriften kann.

## Erst das Problem ansehen {#see-the-problem-first}

Bevor es an die Lösung geht, ein Gefühl für die Größenordnung. Gib einen Rechnungsbetrag ein, einen Steuersatz und die Zahl der gleich großen Raten. Jede Rate wird auf zwei Arten aufgeteilt: so, wie es Buchhaltungssoftware üblicherweise macht, mit eigener Rundung pro Rate, und mit der Methode, die der Rest dieses Beitrags aufbaut. Achte darauf, wie die Summe bei **Normal gerundet** von der Rechnung abweicht und die bei **PennyWise** nicht.

{% include pennywise-tax-meter.html %}

Bei einer einzelnen Rechnung liegt die übliche Methode selten mehr als ein paar Cent daneben. Rechne das auf ein Jahr voller Rechnungen hoch, oder auf jeden Shop auf einem Marktplatz. Dann ist es die Zeile im Abgleich, die niemand erklären kann. Die nächsten drei Abschnitte zeigen, wie PennyWise dafür sorgt, dass die rechte Spalte jedes Mal aufgeht.

## Teil 1: in Atomen rechnen, nicht in ganzen Währungseinheiten

Der erste Schritt ist der, den jeder Artikel nach dem Motto „Geld nie als Float speichern“ empfiehlt. Du wählst eine feste, unteilbare Einheit, ein **Atom**, und rechnest nur mit ganzen Zahlen von Atomen. Das Atom ist nicht unbedingt die kleinste Münze, die es gibt. Es ist die kleinste Einheit, die *dein System* nicht weiter teilt. Es muss nur klein genug sein und für die ganze Rechnung gleich bleiben, sodass jeder Betrag, der je vorkommt, eine ganze Zahl von Atomen ist.

- Eine typische Währung: Das Atom ist ein Cent. `10.70` sind `1070`.
- Ein Bankensystem, das für Zinsen oder Gebühren Genauigkeit unter einem Cent braucht: Das Atom ist ein Hundertstel Cent. `10.70` sind `107000`, und ein Satz, der mitten in der Rechnung angewendet wird, darf auf `0.0001` landen, ohne vorzeitig gerundet zu werden.
- Bitcoin: Das Atom ist ein Satoshi, `0.00000001` BTC. Ein Bitcoin sind `100_000_000`.
- Eine Währung ohne Untereinheit: Das Atom ist eine ganze Einheit.

```
to_atoms(amount, atom):
    q = amount / atom
    fail unless q is a whole number      # 10.705 ist keine echte Zahlung
    return integer(q)
```

Ab hier gibt es im Code keine Währung mehr, nur noch Anzahlen. `1070` Atome Rechnung, `500` Atome erste Zahlung. Ganze Zahlen addieren sich exakt, und genau darum geht es. Ein Bruch darf nur in den nächsten beiden Schritten auftauchen, und dort wird er sofort wieder auf eine ganze Zahl abgerundet.

## Teil 2: die Steuer einmal für die ganze Rechnung herausrechnen

Bevor irgendeine Zahlung verarbeitet wird, berechnest du den Steueranteil der ganzen Rechnung in Atomen, ein einziges Mal:

```
total_tax_atoms(total_atoms, rate):
    # exakte rationale Arithmetik, dann ein einziges Abrunden
    return floor( total_atoms * rate / (1 + rate) )
```

`rate` ist hier ein exakter Bruch, `7/100`, nicht die binäre Gleitkommazahl `0.07` (die in Wahrheit `0.070000000000000006...` ist). Mach diesen Schritt mit dem exakten oder rationalen Zahlentyp, den deine Sprache anbietet. Dann ist das eine `floor` der einzige Schritt, der daraus wieder eine ganze Zahl macht. Im Beispiel ist `floor(1070 * (7/100) / (107/100))` gleich `floor(70.0)`, also `70`.

Diese `70` sind jetzt ein festes Ziel. Alles, was die Bibliothek ab hier tut, ist, diese 70 Steuer-Atome so auf die Zahlungen zu verteilen, dass sie zusammen genau 70 ergeben, egal wie die Zahlungen ausfallen. Die Netto-Atome sind einfach `total_atoms - total_tax_atoms`, hier `1000`, und werden per Subtraktion genauso verteilt.

## Teil 3: die laufende Summe, die nur abgerundet werden darf

Auf dieser Idee baut die ganze Bibliothek auf. Sie ist kleiner, als sie klingt.

Definiere eine Funktion, die eine einzige Frage beantwortet: **Wenn `p` Atome dieser Rechnung bezahlt sind, wie viele ganze Steuer-Atome sind damit abgedeckt?**

```
tax_through(p, total_tax_atoms, total_atoms):
    return 0 if total_atoms == 0
    return floor( p * total_tax_atoms / total_atoms )
```

Das ist eine gerade Rampe von `(0, 0)` bis `(total_atoms, total_tax_atoms)`, an jedem Punkt auf ganze Atome abgerundet. `tax_through(0)` ist `0`. `tax_through(total_atoms)` ist `floor(total_tax_atoms)`, und das ist schon eine ganze Zahl, also genau `total_tax_atoms`. Beide Endpunkte stehen fest.

Die Steuer in einer einzelnen Zahlung ist dann einfach die **Differenz zweier Ablesungen** dieser Funktion, eine vor der Zahlung und eine danach:

```
split_payment(amount_atoms, previously_paid_atoms, total_tax_atoms, total_atoms):
    before = tax_through(previously_paid_atoms,                total_tax_atoms, total_atoms)
    after  = tax_through(previously_paid_atoms + amount_atoms, total_tax_atoms, total_atoms)
    tax = after - before
    net = amount_atoms - tax
    return { tax: tax, net: net }
```

Rechnen wir das Beispiel durch. `total_tax_atoms = 70`, `total_atoms = 1070`.

| Zahlung | vorher bezahlt | danach bezahlt | `tax_through` vorher | `tax_through` danach | Steuer dieser Zahlung |
|---|---:|---:|---:|---:|---:|
| 5,00 | 0 | 500 | `floor(0.00)` = 0 | `floor(32.71)` = 32 | **32** |
| 5,00 | 500 | 1000 | `floor(32.71)` = 32 | `floor(65.42)` = 65 | **33** |
| 0,70 | 1000 | 1070 | `floor(65.42)` = 65 | `floor(70.00)` = 70 | **5** |

Summe der Steuer: `32 + 33 + 5 = 70`. Genau die Rechnung. Der zusätzliche Cent ist in der zweiten Zahlung gelandet, weil die Gerade `p * 70 / 1070` genau zwischen diesen beiden Ablesungen eine ganze Zahl überquert. Das war keine Entscheidung. Es war eine Koordinate.

### Warum es immer aufgeht

Die Zahlungen schneiden das Intervall `[0, total_atoms]` in aufeinanderfolgende Stücke:

```
0 = p_0  <  p_1  <  p_2  <  ...  <  p_k = total_atoms
```

Die Steuer über alle Stücke zusammen ist

```
  ( tax_through(p_1) - tax_through(p_0) )
+ ( tax_through(p_2) - tax_through(p_1) )
+ ...
+ ( tax_through(p_k) - tax_through(p_{k-1}) )
```

Jeder innere Term kommt einmal mit Plus und einmal mit Minus vor. Die Summe **teleskopiert** zu `tax_through(p_k) - tax_through(p_0)`, also `total_tax_atoms - 0`. Es gibt keine Rundungsregel, über die man streiten könnte, keinen Zähler, der zurückgesetzt werden muss, und keinen Sonderfall „wohin mit dem Rest“. Die mittleren Terme heben sich auf dem Papier auf. Die Summe ist also schon durch die Konstruktion exakt, für jede Rechnung, in beliebig viele Teile zerlegt, in beliebiger Reihenfolge.

Zwei weitere Eigenschaften gibt es aus demselben Bild gratis dazu:

- **Keine Zahlung bekommt je negative Steuer.** `tax_through` fällt nie, denn es ist eine abgerundete, nicht negative Steigung. Also gilt immer `after >= before`.
- **Keine Zahlung bekommt mehr Steuer, als sie groß ist.** Die Steigung `total_tax_atoms / total_atoms` ist höchstens `1` (die Steuer kann nicht größer sein als die Rechnung). Über eine Strecke von `n` Atomen kann die abgerundete Rampe also um höchstens `n` steigen. Damit bleibt `net` bei null oder darüber.

Und weil `split_payment` nur `previously_paid_atoms` und die beiden Konstanten der Rechnung braucht, musst du zwischen zwei Zahlungen **eine einzige ganze Zahl** speichern. Du kannst nach Zahlung zwei aufhören, `1000` ablegen, nächsten Monat weitermachen, und Zahlung drei kommt genauso heraus. Eine Tabelle mit dem Zahlungsverlauf brauchst du nicht.

## Abrunden statt runden: die ehrliche Wahl

Es ist verlockend, `tax_through` auf das nächste Atom zu runden statt abzurunden. Lass es. Abrunden heißt: Zu keinem Zeitpunkt der Ratenfolge weist ein Beleg Steuer aus, die noch gar nicht bezahlt ist. Die Rampe liegt die ganze Zeit auf oder knapp unter der wahren proportionalen Linie und holt sie erst mit der letzten Zahlung genau ein. Beim Runden könnten Zahlungen zwischendurch etwas über dem wahren Anteil liegen, und das müsste später wieder abgezogen werden. Das ist auf einem Beleg schwerer zu erklären.

Die Form, die dabei entsteht, ist eine schräge Linie, angenähert durch eine Treppe aus Einheitsstufen, so gleichmäßig verteilt, wie es die ganzen Zahlen erlauben. Genau diese Form entsteht auch, wenn ein Computer eine schräge Linie auf ein Pixelraster zeichnet. Das ist der [Bresenham-Algorithmus](https://de.wikipedia.org/wiki/Bresenham-Algorithmus) von 1962. Dasselbe macht ein gutes analoges Foto mit einem Farbverlauf und Audio-Dithering mit einer Ausblende. „N unteilbare Dinge so gleichmäßig wie möglich auf M Plätze verteilen, ohne Abdrift“ ist ein wirklich altes Problem mit einer wirklich geklärten Antwort. Steuer auf Raten zu verteilen ist nur eine weitere Variante davon, im Anzug.

{% include pennywise-bresenham.html %}

## Wie man „immer“ testet

„Die Teile ergeben immer das Ganze“ ist eine starke Behauptung. Drei Beispiele zu schreiben und Feierabend zu machen, reicht dafür nicht. PennyWise wird mit **eigenschaftsbasiertem Testen** (Property-based Testing) geprüft: Das Testwerkzeug erzeugt Tausende zufälliger Szenarien und prüft bei jedem die Invariante.

```
repeat 1000 times:
    total_atoms = random integer in 1 .. 10_000_000
    rate        = random fraction in 0 .. 1/2
    # zufällige Schnittpunkte wählen, sortieren, die Abstände als Zahlungen nehmen,
    # damit die Zahlungen garantiert total_atoms ergeben
    cuts  = sorted( [0, total_atoms] + random points in 0 .. total_atoms )
    parts = consecutive differences of cuts, dropping zeros

    expected = total_tax_atoms(total_atoms, rate)
    paid, tax_sum, net_sum = 0, 0, 0
    for part in parts:
        s = split_payment(part, paid, expected, total_atoms)
        tax_sum += s.tax
        net_sum += s.net
        paid    += part

    assert tax_sum == expected
    assert net_sum == total_atoms - expected
    assert tax_sum + net_sum == total_atoms
```

Zufällige Beträge, zufällige Steuersätze, zufällig viele Teile in zufälliger Größe. Der Generator baut die Teile aus sortierten Schnittpunkten, damit ihre Summe schon per Konstruktion genau dem Gesamtbetrag entspricht. Kaputtgehen kann dann nur noch die Verteilung. Ein zufälliger Satz von Schnittpunkten ist gleichzeitig ein zufälliger Ratenplan und eine zufällig aufgeteilte Rechnung. Dieser eine Test deckt also beide Lesarten des Problems ab.

Wäre das Teleskop-Argument oben falsch, würden tausend Zufallsziehungen das finden. Sie finden nichts, weil es stimmt. Für diese Art von Test gibt es in jeder Sprache eine Bibliothek: `hypothesis`, `fast-check`, `QuickCheck` und andere.

## Die Randfälle, die man nennen sollte

- **Überzahlung.** Eine Zahlung, die den bezahlten Betrag über die Rechnung hinaus treiben würde, wird abgelehnt, bevor sie aufgeteilt wird. Sie wird nicht stillschweigend gekürzt.
- **Beträge, die kein ganzes Atom sind.** `10.705` bei einem Atom von einem Cent kann niemand wirklich bezahlen. `to_atoms` lehnt das ab, statt es auf etwas Plausibles zu runden.
- **Rechnung über null.** `tax_through` gibt sofort `0` zurück. Eine Rechnung über null zerfällt also in lauter Nullen, ohne dass durch irgendetwas geteilt wird.
- **Negative Eingaben.** Werden gleich am Eingang abgelehnt. Eine negative Zahlung ergibt in diesem Modell keinen Sinn.

## Eine Rechnung aufteilen ist dasselbe Problem {#splitting-a-bill-is-the-same-problem}

Bisher ging es immer um eine Person, die über die Zeit einen Betrag abbezahlt. Jetzt eine ganz andere Szene: eine Restaurantrechnung, drei Leute am Tisch, alle legen im selben Moment einen anderen Betrag hin. Wie viel Steuer steckt in jedem Anteil?

Es ist genau dieselbe Rechnung. Die drei Anteile zerlegen weiterhin `[0, total_atoms]`. Der einzige Unterschied: Es gibt kein „bisher bezahlt“, das sich über Wochen ansammelt. Du gehst die aufsummierten Grenzen also in einem Durchgang ab:

```
split_bill(shares_in_atoms, total_tax_atoms, total_atoms):
    result  = []
    running = 0
    for share in shares_in_atoms:
        before = tax_through(running,         total_tax_atoms, total_atoms)
        after  = tax_through(running + share, total_tax_atoms, total_atoms)
        tax    = after - before
        result.append({ tax: tax, net: share - tax })
        running += share
    return result
```

Dem Teleskop-Argument ist es egal, ob die Stücke drei Zahlungen einer Person über ein Quartal sind oder drei Anteile von drei Leuten in derselben Sekunde. Es ist in beiden Fällen eine Zerlegung. Die inneren Terme heben sich weiterhin auf, und die Steuer für den ganzen Tisch ergibt genau das, was auf der Rechnung steht.

Die Reihenfolge ändert nichts an der Summe. Sie entscheidet nur, welcher Anteil einen übrigen Cent abbekommt. Wenn beim Aufteilen von `10.70` auf drei Leute eine Person einen Cent mehr zahlt, ist das echt und unvermeidbar, denn 70 ist nicht durch 3 teilbar. Aussuchen kannst du dir nur, wo er landet. Sortiere die Anteile und lass den größten den Cent übernehmen. Oder wechsle bei Stammgästen von Abend zu Abend durch. Mit PennyWise ist das eine Entscheidung in einer Zeile statt ein Bug.

## Zum Schluss

Keines der Teile hier ist neu. Geld als ganze Zahlen zu speichern ist ein Standardrat. Steuer mit `r / (1 + r)` herauszurechnen steht in jedem Buchhaltungslehrbuch. Der Trick mit der Teleskopsumme ist Analysis im ersten Semester, und die Treppe ist sechzig Jahre alt. Ihren Namen verdient die Bibliothek, weil diese Teile zusammen eine Funktion ergeben, deren Eigenschaft sich in einem Satz sagen und in zwei Sätzen beweisen lässt: **Die Teile ergeben immer das Ganze, weil sich die mittleren Terme aufheben.**

Die Variante, die jede Rate für sich rundet, ist schneller geschrieben und sieht in der Demo richtig aus. Sie scheitert leise, in großem Maßstab, und irgendwen kostet das einen Abgleich. Die Variante mit einer einzigen laufenden Steuersumme, die nur abgerundet wird, ist kaum länger. Und sie kann so nicht scheitern, denn es gibt keinen Zähler, der abdriftet, und keinen Rest, der ein Zuhause sucht. Meistens ist das der bessere Tausch.

Und weil der Beweis von Zerlegungen handelt und nicht von Zahlungen, teilt dieselbe Funktion die Steuer auf einen Ratenplan auf, auf ein gemeinsames Abendessen, auf Kostenstellen oder auf die Auszahlungen an die Shops eines Marktplatzes. Das war nie das Ziel. Es ist einfach das, was man bekommt, wenn die Garantie aus der Arithmetik kommt statt aus einer Rundungsregel.
