# Nexora HCM Lite — Project Overview

Nexora HCM Lite ek simple HR management demo hai jo HTML, CSS, Bootstrap 5.3 aur basic JavaScript se banaya gaya hai. Is mein React ya kisi build tool ki zaroorat nahi. Data browser ke local storage mein save hota hai.

# 1. Project kaise run karein?

- `index.html` browser mein open karein, ya VS Code mein Live Server use karein.
- Fonts aur Bootstrap styling ke liye internet connection zaroori hai.
- Login ke liye valid email format aur koi bhi non-empty password enter karein.
- Administrator select karne par dashboard aur **Employee** select karne par employee portal open hoga.

Ye sirf demo login hai, secure authentication system nahi.

# 2. Project ke pages

- index.html: Login aur company setup.
- admin.html: Dashboard, employee overview, attendance aur summary charts.
- employees.html: Employees add, edit, search aur delete karna.
- leaves.html: Leave requests dekhna, approve/reject karna aur CSV export karna.
- employee.html: Check-in/check-out, leave apply karna aur attendance history dekhna.
- payship.html: Demo payslips banana, salary breakdown dekhna aur print karna.
- setting.html: Company details, working hours, leave policy aur preferences manage karna.

# 3. Data kahan save hota hai?

Employees, attendance, leaves, company settings aur payslips browser ke `localStorage` mein save hote hain. Login session `sessionStorage` mein hota hai.

- Page reload karne par saved data rehta hai.
- Sign Out karne se demo session clear hota hai, business records delete nahi hote.
- Employee delete karne par uski purani leave, attendance aur payroll history automatically delete nahi hoti.
- Data sirf us browser mein hota hai; ye shared database nahi hai.

Important: Browser ka data clear karne se saved records lose ho sakte hain. Is liye ye system real company ke sensitive data ke liye nahi hai.

# 4. Dashboard aur security

Dashboard par hiring chart sirf example ke liye hai; ye real hiring statistics nahi dikhata. Payroll chart saved demo payslips se calculate hota hai, aur helper simple rules par kaam karta hai, AI par nahi.

# 5. Testing status

Code ki basic checking complete hai:

- JavaScript syntax check pass hua.
- HTML pages mein duplicate IDs aur broken local file links check kiye gaye.
- Navigation links aur CSS/JS references verify kiye gaye.

Browser mein complete testing abhi nahi ho saki. Is liye manually login, employee CRUD, attendance, leave approval, settings save, payslip printing aur mobile layout test karein.

Mobile aur desktop par 320px se 1440px+ tak different screen sizes check karna bhi zaroori hai.

Final note: Nexora HCM Lite ek frontend demo project hai jo HR management ke basic workflows dikhata hai. Real-world use ke liye secure backend, database aur proper authentication ki zaroorat hogi.