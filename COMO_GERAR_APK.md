# 📱 Como Gerar o APK - Dani Cosméticos

## ✅ Configuração Completa

O projeto já está configurado com Capacitor! O app vai carregar de **https://dani-cosmeticos.vercel.app/** dentro de um WebView Android.

---

## 🚀 Passos para Gerar o APK

### 1. Pré-requisitos

Você precisa ter instalado:
- ✅ **Android Studio** - [Download aqui](https://developer.android.com/studio)
- ✅ **Java JDK 17+** (já vem com Android Studio)

### 2. Abrir Projeto no Android Studio

Execute este comando para abrir o projeto Android:

```powershell
npx cap open android
```

Isso vai abrir o Android Studio automaticamente com o projeto configurado.

**Aguarde**: Na primeira vez, o Android Studio vai baixar dependências (pode demorar 5-10 minutos).

### 3. Gerar o APK

No Android Studio:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguarde a compilação (barra de progresso na parte inferior)
3. Quando terminar, clique em **"locate"** no popup que aparecer
4. O arquivo `.apk` estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Instalar no Tablet/Celular

**Opção A - Via USB:**
1. Ative **Depuração USB** no tablet (Configurações → Opções do desenvolvedor)
2. Conecte o tablet via USB
3. No Android Studio: **Run → Run 'app'** (botão play verde)
4. O app instala e abre automaticamente

**Opção B - Compartilhar APK:**
1. Copie o arquivo `app-debug.apk`
2. Envie via WhatsApp, Drive, ou email
3. No tablet, abra o arquivo e instale (pode precisar permitir "instalar apps de fontes desconhecidas")

---

## 🔄 Como Funcionam os Updates

### ✨ Updates Automáticos (99% dos casos)

Quando você faz mudanças no código e faz deploy na Vercel:
- ✅ **App mobile atualiza SOZINHO** (próxima vez que abrir)
- ❌ **NÃO precisa gerar novo APK**
- ❌ **NÃO precisa reinstalar**

**Por quê?** O APK é só um "navegador dedicado" que aponta para `https://dani-cosmeticos.vercel.app/`. 

Exemplos que atualizam automaticamente:
- Mudou UI/componentes React
- Mudou API routes
- Mudou estilos/CSS
- Adicionou funcionalidades
- Corrigiu bugs

### ⚠️ Quando Precisa Gerar Novo APK

Só se mudar **configurações nativas do Android**:
- Trocar ícone do app
- Mudar nome do app
- Adicionar permissões (câmera, GPS, etc.)
- Mudar URL do servidor

**Frequência:** Quase nunca (1x no ano ou menos)

---

## 🎨 Trocar o Ícone do App (Opcional)

O app está usando o ícone padrão. Para personalizar:

1. Crie um ícone PNG de **1024x1024 pixels**
2. Salve como: `resources/icon.png`
3. Instale o gerador de assets:
   ```powershell
   npm install -g @capacitor/assets
   ```
4. Gere os assets:
   ```powershell
   npx capacitor-assets generate
   ```
5. Sincronize novamente:
   ```powershell
   npx cap sync android
   ```
6. Gere um novo APK (passos acima)

---

## 🛠️ Comandos Úteis

```powershell
# Abrir projeto no Android Studio
npx cap open android

# Sincronizar mudanças (após alterar capacitor.config.ts)
npx cap sync android

# Ver logs do app em tempo real
npx cap run android
```

---

## 📂 Estrutura do Projeto

```
cosmeticos-app/
├── android/                    # Projeto Android (gerado pelo Capacitor)
├── capacitor.config.ts         # Configuração do Capacitor
├── out/                        # Placeholder (app real vem da Vercel)
└── resources/                  # Ícones e splash screens
```

---

## ❓ Troubleshooting

### Erro: "SDK not found"
- Abra Android Studio → Tools → SDK Manager
- Instale "Android SDK Platform 33" ou superior

### Erro ao compilar
1. No Android Studio: File → Invalidate Caches → Restart
2. Rebuild: Build → Clean Project → Rebuild Project

### App abre mas tela branca
- Verifique se `https://dani-cosmeticos.vercel.app/` está acessível no navegador
- Verifique conexão com internet no tablet

### App não instala no tablet
- Vá em Configurações → Segurança → Permitir "Fontes desconhecidas"

---

## 🎯 Próximos Passos

1. ✅ **Gere o APK de debug** (para testes)
2. 📲 **Instale no tablet** da Dani
3. 🧪 **Teste todas as funcionalidades**
4. 🚀 **Use normalmente** - updates são automáticos!

Quando estiver pronto para **publicar na Play Store** (opcional):
- Custo: US$ 25 (uma vez só)
- Processo: Gerar APK assinado (release) + criar conta de desenvolvedor

---

**Configurado por:** Cascade AI  
**Data:** 16 de Fevereiro de 2026  
**URL do App:** https://dani-cosmeticos.vercel.app/
