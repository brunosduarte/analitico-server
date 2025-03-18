# Extrator de Extratos Analíticos Portuários

Esta aplicação é um sistema back-end desenvolvido em Node.js com TypeScript que permite extrair dados de extratos analíticos de trabalhadores portuários em formato PDF e salvá-los em um banco de dados MongoDB.

## 📋 Funcionalidades

- Upload de arquivos PDF contendo extratos analíticos
- Extração automática de dados estruturados dos PDFs
- Armazenamento das informações em MongoDB
- API RESTful para consulta dos dados extraídos
- Suporte para diferentes categorias de trabalhadores portuários (estivador, arrumador, vigia e conferente)

## 🛠️ Tecnologias Utilizadas

- **Node.js**: Ambiente de execução JavaScript do lado do servidor
- **TypeScript**: Superset tipado de JavaScript
- **Express**: Framework web para Node.js
- **MongoDB** e **Mongoose**: Banco de dados NoSQL e ODM para Node.js
- **Multer**: Middleware para manipulação de uploads de arquivos
- **PDF2JSON**: Biblioteca para extração de dados de PDFs
- **Zod**: Biblioteca para validação de esquemas
- **dotenv**: Gerenciamento de variáveis de ambiente

## 🗂️ Estrutura do Projeto

```
extrator-extratos-portuarios/
├── src/
│   ├── controllers/
│   │   └── ExtratoController.ts
│   ├── models/
│   │   └── ExtratoModel.ts
│   ├── services/
│   │   └── PDFService.ts
│   ├── schemas/
│   │   └── ExtratoSchema.ts
│   ├── config/
│   │   └── database.ts
│   ├── routes/
│   │   └── extratoRoutes.ts
│   ├── utils/
│   │   └── pdfParser.ts
│   └── app.ts
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── .gitignore
└── README.md
```

## 📦 Instalação

### Pré-requisitos

- Node.js (v14 ou superior)
- MongoDB (local ou remoto)

### Passos para Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/extrator-extratos-portuarios.git
   cd extrator-extratos-portuarios
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
   
   Abra o arquivo `.env` e configure as variáveis:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/extratos_portuarios
   ```

4. Compile o TypeScript:
   ```bash
   npm run build
   ```

5. Inicie o servidor:
   ```bash
   npm start
   ```

   Para desenvolvimento, você pode usar:
   ```bash
   npm run dev
   ```

## 🚀 Uso da API

### Upload de Extrato Analítico
```
POST /analitico
Content-Type: multipart/form-data
```

**Parâmetros:**
- `arquivo`: Arquivo PDF contendo o extrato analítico

**Exemplo de uso (curl):**
```bash
curl -X POST \
  http://localhost:3000/analitico \
  -H 'Content-Type: multipart/form-data' \
  -F 'arquivo=@/caminho/para/extrato.pdf'
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Extrato analítico processado com sucesso",
  "data": {
    "matricula": "242-9",
    "nome": "BRUNO SOUZA DUARTE",
    "mes": "JAN",
    "ano": "2023",
    "categoria": "ESTIVADOR",
    "totalItens": 18
  }
}
```

### Listar Extratos
```
GET /analitico
```

**Parâmetros de consulta (opcionais):**
- `matricula`: Filtrar por matrícula
- `nome`: Filtrar por nome do trabalhador
- `mes`: Filtrar por mês (JAN, FEV, etc.)
- `ano`: Filtrar por ano
- `categoria`: Filtrar por categoria (ESTIVADOR, ARRUMADOR, etc.)

**Exemplo de uso (curl):**
```bash
curl -X GET \
  'http://localhost:3000/analitico?mes=JAN&ano=2023'
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "data": [
    {
      "id": "60f7e5b3a9c0a23d4c8b4567",
      "matricula": "242-9",
      "nome": "BRUNO SOUZA DUARTE",
      "mes": "JAN",
      "ano": "2023",
      "categoria": "ESTIVADOR",
      "totalItens": 18
    }
  ]
}
```

### Obter Extrato por ID
```
GET /analitico/:id
```

**Exemplo de uso (curl):**
```bash
curl -X GET \
  http://localhost:3000/analitico/60f7e5b3a9c0a23d4c8b4567
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "data": {
    "_id": "60f7e5b3a9c0a23d4c8b4567",
    "matricula": "242-9",
    "nome": "BRUNO SOUZA DUARTE",
    "mes": "JAN",
    "ano": "2023",
    "categoria": "ESTIVADOR",
    "itens": [
      {
        "dia": "03",
        "folha": "674744",
        "tomador": "00",
        "pasta": "801",
        "fun": "B",
        "tur": "1",
        "ter": "05/01",
        "pagto": "05/01",
        "baseDeCalculo": 395.95,
        "inss": 29.7,
        "impostoDeRenda": 0,
        "descontoJudicial": 0,
        "das": 23.76,
        "mensal": 0,
        "impostoSindical": 0,
        "descontosEpiCracha": 0,
        "liquido": 342.49,
        "ferias": 44.03,
        "decimoTerceiro": 33.02,
        "encargosDecimo": 2.48,
        "fgts": 37.84
      },
      // ... outros itens
    ],
    "folhasComplementos": {
      "baseDeCalculo": 11660.67,
      "inss": 877.22,
      "impostoDeRenda": 2043.95,
      "descontoJudicial": 0,
      "das": 699.66,
      "mensal": 0,
      "impostoSindical": 0,
      "descontosEpiCracha": 0,
      "liquido": 8039.84,
      "ferias": 1296.68,
      "decimoTerceiro": 972.5,
      "encargosDecimo": 72.94,
      "fgts": 1114.37
    },
    "revisadas": {
      "baseDeCalculo": 0,
      "inss": 0,
      "impostoDeRenda": 0,
      "descontoJudicial": 0,
      "das": 0,
      "mensal": 0,
      "impostoSindical": 0,
      "descontosEpiCracha": 0,
      "liquido": 0,
      "ferias": 0,
      "decimoTerceiro": 0,
      "encargosDecimo": 0,
      "fgts": 0
    },
    "createdAt": "2023-12-31T00:00:00.000Z",
    "updatedAt": "2023-12-31T00:00:00.000Z"
  }
}
```

## ⚠️ Tratamento de Erros

A API possui tratamento para os seguintes erros:
- Arquivo ausente
- Formato de arquivo inválido (apenas PDF é aceito)
- Arquivo corrompido ou ilegível
- Erro de extração de dados
- Erro de conexão com banco de dados

## 📝 Observações sobre a Extração de Dados

O sistema extrai as seguintes informações dos extratos analíticos:

1. **Cabeçalho**:
   - Matrícula e nome do trabalhador
   - Mês e ano do extrato
   - Categoria do trabalhador (estivador, arrumador, vigia ou conferente)

2. **Itens do Extrato**:
   - Dia, folha, tomador e demais informações da tabela principal
   - Valores numéricos como base de cálculo, INSS, imposto de renda, etc.

3. **Resumos**:
   - Informações de "Folhas/Complementos"
   - Informações de "Revisadas"

## 🔍 Lógica de Extração

O processo de extração usa uma combinação de técnicas para identificar corretamente as informações no PDF:

1. Extração de texto estruturado usando PDF2JSON
2. Análise de padrões para identificar cabeçalho, linhas de dados e resumos
3. Normalização de valores numéricos (conversão de string para número)
4. Validação dos dados usando Zod

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir, siga estes passos:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona MinhaFeature'`)
4. Faça push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
