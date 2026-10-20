# ReLoop Passport, frontend

Interface React (Vite + Tailwind CSS 4) branchée sur le backend Express/MongoDB du dossier parent.
Aucun rôle « inspecteur » : les rôles sont ceux du backend (Propriétaire, Réparateur, Acheteur et recycleur, Administrateur).

## Démarrer

```bash
# 1. Backend (dossier parent)
npm install
cp .env.example .env        # puis renseigner MONGO_URI, JWT_SECRET, ADMIN_*, HEDERA_OPERATOR_*
npm run seed:admin
npm run dev                 # http://localhost:5000

# 2. Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173  (le proxy Vite redirige /api vers :5000)
```

## Parcours couverts

| Rôle | Ce qu'il fait dans l'interface |
|---|---|
| Public | Accueil, recherche par ReLoop ID, passeport public, vérification du numéro de série et des factures dans le navigateur |
| Propriétaire | Créer un passeport, consulter l'historique, enregistrer la maintenance, vendre ou transférer par e-mail, mettre en vente pour pièces |
| Réparateur | Ouvrir un passeport par ReLoop ID, enregistrer une réparation avec facture hachée en SHA-256, maintenance, déclarer la fin de vie |
| Acheteur et recycleur | Consulter les passeports, acheter pour pièces, accepter des transferts, déclarer un recyclage ou une mise hors service |
| Administrateur | Vue d'ensemble et graphiques, vérification des comptes pro et examen des inspections techniques |

Les propriétaires peuvent joindre un certificat au passeport d'un appareil et associer une société déjà vérifiée par un administrateur. Les certificats transmis apparaissent dans l'espace admin pour approbation ou rejet. Les demandes d'inspection des propriétaires sont visibles dans la liste des inspections admin dès leur création ; les rapports signés restent soumis à examen après intervention du réparateur.

Pour une inspection technique, l'admin assigne chaque demande ouverte à un réparateur actif et vérifié ou la refuse avec un motif. Le réparateur assigné accepte la demande et soumet son rapport signé ; ce rapport revient ensuite à l'admin pour approbation. Le propriétaire voit l'état de la demande sur son tableau de bord et le passeport. Une décision « non réparable » ne modifie le cycle de vie qu'après approbation par l'admin.

## Ce qui reste dans le navigateur

Le numéro de série est haché (SHA-256, espaces retirés, majuscules) avant envoi : le backend ne reçoit que `serialNumberHash`.
Les fichiers vérifiés côté acheteur ne sont jamais téléversés.

## Notes

- Interface en français. Les messages d'erreur du backend sont traduits dans `src/lib/api.js`.
- Production : `npm run build`, servez `dist/` derrière le même domaine que l'API (ou définissez `VITE_API_URL`) et réglez `CLIENT_URL` côté backend.

## Structure

```
src/
  lib/         api (axios + erreurs FR), auth, hash SHA-256, labels et formats
  components/  BandStrip (signature visuelle), Plate, Timeline, VerifyDevice, Shell, ui
  pages/       une page par écran ; pages/admin pour l'administration
```
