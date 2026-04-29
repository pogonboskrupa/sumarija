# Šumarija Krupa — Native Android App

Native Android aplikacija za evidenciju sječe i otpreme.  
Kotlin + Jetpack Compose · Min SDK 26 (Android 8.0) · Isti backend kao web app

---

## Kloniranje projekta na Windows

Otvori **Command Prompt** ili **PowerShell** i pokreni:

```
git clone -b android https://github.com/pogonboskrupa/sumarija.git "C:\Users\NEDIM\Desktop\NATIVE APP POGON"
```

---

## Otvaranje u Android Studiu

1. Otvori **Android Studio**
2. **File → Open**
3. Odaberi folder `C:\Users\NEDIM\Desktop\NATIVE APP POGON`
4. Klikni **OK** i sačekaj da Gradle sync završi (prva sinhronizacija traje 3–5 minuta, preuzima dependencies)
5. Pritisnij zeleni **▶ Run** dugme ili `Shift+F10`

---

## Keystore (za potpisivanje APK release verzije)

> Keystore fajl `sumarija-release.jks` je lokalno na mašini gdje je projekat kreiran.  
> Za izgradnju debug verzije (testiranje) keystore **nije potreban**.

| Polje | Vrijednost |
|---|---|
| Keystore file | `sumarija-release.jks` (u root folderu projekta) |
| Alias | `sumarija` |
| Store password | `sumarija2024` |
| Key password | `sumarija2024` |

**SHA-1 fingerprint:**
```
07:74:20:15:DC:2F:46:04:A8:26:33:39:FD:C9:BF:00:A7:8D:AE:34
```

**SHA-256 fingerprint:**
```
31:53:16:27:3A:02:E1:2E:1D:00:E6:CB:3A:C1:6A:DF:99:09:5A:7D:A6:2F:A6:A9:71:69:88:97:ED:57:35:47
```

---

## Supabase setup — tabela korisnika

### Korak 1: Kreiraj tabelu

U **Supabase → SQL Editor** pokreni:

```sql
create table mobile_korisnici (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  user_type text not null check (user_type in ('primac','otpremac','poslovodja','operativa','admin')),
  active boolean default true,
  created_at timestamptz default now()
);

alter table mobile_korisnici enable row level security;
create policy "login_check" on mobile_korisnici
  for select using (true);
```

### Korak 2: Unesi korisnike

```sql
insert into mobile_korisnici (username, password_hash, full_name, user_type, active) values
  ('TulicA', 'd2e7c4f17a70bb40252529b72548c40f730957775f8711098c657f116d720dd2', 'Tulić Amir', 'primac', true),
  ('SeficA', '79b50932dd998d253b85c9f6c57c6b64dac3e58c252c38720af0ee7a249860eb', 'Sefić Almir', 'primac', true),
  ('CehicN', 'c5d4a63dbef4f919bd9cb1690deb3aa0eca57e71fc9af9570465852e2e91357c', 'Čehić Nedžad', 'primac', true),
  ('VelagicJ', '8d2efba45f136abdd6d9548ca3be7df0542bb39e5c0aadba883e191d1c54712b', 'Velagić Jasmin', 'primac', true),
  ('SalkicA', '10dc3974968a40b48292568b0ac0a2c73f569f48f6b83c36e3c0fc23c0a6ff8d', 'Salkić Adnan', 'primac', true),
  ('MusicA', '52bb7cc738dbf5e5eee2c76754d87904e6750c63eda5e0a866197d2e16d9c142', 'Musić Adnan', 'primac', true),
  ('IsmailovskiA', 'eabba30726dc87c8db1fb464153e598cd126be0b58dd70169097fd1dea814fa2', 'Ismailovski Abas', 'primac', true),
  ('DurakovicA', '0639abc6a99564251d773e2b65737aa55be9d38ee690bfbbaa80cf9347a8b79a', 'Duraković Arslan', 'primac', true),
  ('CehajicH', '32bcc73fecc37ec1be8595b0d75e4a939d88e99d9c664c86147cab1e60be679a', 'Čehajić Hasan', 'otpremac', true),
  ('AlidzanovicE', '79bbd7403e9cfd9484707f04c4a600de24ecdc78aea71b12fb515e1bb947bf11', 'Alidžanović Elvis', 'otpremac', true),
  ('HadzipasicI', 'a96d8d8c2f1ebe18cca3938a784c8f14b32e2ad4de7786ac59e4069d9dcaee45', 'Hadžipašić Ibrahim', 'otpremac', true),
  ('ArnautovicA', '131f4493792b4c6d292a7705ab7683a5097b4da974c3d33959924ee2ff164b50', 'Arnautović Almir', 'otpremac', true),
  ('SabicR', '7ad3866ca9ab8880b6d411a396548f4094a1e20714471ccc00f98d2248191b5f', 'Šabić Reuf', 'otpremac', true),
  ('pogonboskrupa', 'dc05b22bd6e71d36424e963bea31f6eaf6ecb916e62aed3d2fa1988f9f9def3d', 'Šumarija Krupa', 'admin', true),
  ('NedimCehic', 'dafff407d7450f62b0dd0c413f9f0745d70071b8ba4d731d093804be0502184e', 'Tehnolog za gazdovanje šumama', 'admin', true),
  ('IzetVelagic', 'cb03a2c5a7b9b56fb286424939260fb6fda92ba9ed26f01619d3cee8bdac771b', 'Pomoćnik upravnika', 'admin', true),
  ('JasminPoric', 'cdc8541f5a7aa61a63dbd2c4ca47248c69b94b3d27b2a41af87bf82e51869923', 'Jasmin Porić', 'poslovodja', true),
  ('HarbasM', '44129092b149feb27ce8038080020854aa6bb8f1b3ca706ed916e07f8d8268e5', 'Mehmedalija Harbaš', 'poslovodja', true),
  ('IrfanH', '4fc6587089b68c67ea4c95ea94e754e1b314b1b73389574c5f25f3f2a0a78010', 'Irfan Hadžipašić', 'poslovodja', true),
  ('ussume', '44749230d12911b0dd38017d3bb581bb86cf7eee45bae97023025417cef97e68', 'admin', 'admin', true);
```

### Korak 3: Provjera

```sql
select username, full_name, user_type from mobile_korisnici order by user_type, full_name;
-- Treba biti 20 redova
```

---

## Lista korisnika

| Username | Ime i prezime | Panel |
|---|---|---|
| TulicA | Tulić Amir | Primac |
| SeficA | Sefić Almir | Primac |
| CehicN | Čehić Nedžad | Primac |
| VelagicJ | Velagić Jasmin | Primac |
| SalkicA | Salkić Adnan | Primac |
| MusicA | Musić Adnan | Primac |
| IsmailovskiA | Ismailovski Abas | Primac |
| DurakovicA | Duraković Arslan | Primac |
| CehajicH | Čehajić Hasan | Otpremac |
| AlidzanovicE | Alidžanović Elvis | Otpremac |
| HadzipasicI | Hadžipašić Ibrahim | Otpremac |
| ArnautovicA | Arnautović Almir | Otpremac |
| SabicR | Šabić Reuf | Otpremac |
| JasminPoric | Jasmin Porić | Poslovođa |
| HarbasM | Mehmedalija Harbaš | Poslovođa |
| IrfanH | Irfan Hadžipašić | Poslovođa |
| NedimCehic | Tehnolog za gazdovanje šumama | Admin |
| IzetVelagic | Pomoćnik upravnika | Admin |
| pogonboskrupa | Šumarija Krupa | Admin |

---

## Deaktivacija korisnika

U Supabase → Table Editor → mobile_korisnici → postavi `active = false`.

## Promjena lozinke

Generiši SHA-256 hash nove lozinke na https://emn178.github.io/online-tools/sha256.html  
i ažuriraj `password_hash` kolonu u tabeli.

---

## Arhitektura

```
app/src/main/java/ba/pogon/sumarija/
├── data/
│   ├── api/          ← Retrofit + OkHttp (Google Apps Script API)
│   ├── local/        ← DataStore (offline cache + kredencijali)
│   ├── model/        ← Data klase (User, Dashboard, Primac, ...)
│   └── repository/   ← AuthRepository (Supabase login), DataRepository (API)
├── di/               ← Hilt dependency injection
├── navigation/       ← NavGraph (Login → Main)
├── ui/
│   ├── login/        ← Login screen + ViewModel
│   ├── main/         ← MainScreen sa role-based navigacijom
│   ├── screens/      ← Dashboard, Primaci, Otpremaci, Stanje, Kupci, Izvještaji,
│   │                    Poslovodja, Primac personal, Otpremac personal
│   └── theme/        ← Navy blue + Forest green tema
└── util/
```
