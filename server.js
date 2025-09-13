const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mercadopago = require("mercadopago");
const { dbPromise } = require("./db");

// Rotas do projeto
const clientesRoutes = require("./routes/clientes");
const vendasRoutes = require("./routes/vendas");
const produtosRoutes = require("./routes/produtos");
const carrinhoRoutes = require("./routes/carrinho");
const promocoesRoutes = require("./routes/promocoes");
const lojasRoutes = require("./routes/lojas");
const pixRoutes = require("./routes/pix");
const checkoutRoutes = require("./routes/checkout");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Servir imagens
app.use("/imagens", express.static(path.join(__dirname, "imagens")));
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const cnpj = req.body.cnpj;
    const dir = path.join("imagens", cnpj, "produtos");

    // Cria o diretório se não existir
    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // mantém o nome original do arquivo
  },
});

const upload = multer({ storage });

app.delete("/", (req, res) => {
  const { cnpj, nomeImagem } = req.body;

  if (!cnpj || !nomeImagem) {
    return res.status(400).json({
      erro: "CNPJ e nome da imagem são obrigatórios.",
    });
  }

  // Aqui você poderia implementar a exclusão da imagem se quiser
  return res.json({ status: "imagem excluída (não implementado)" });
});

// 📸 Upload de imagem
app.post("/", upload.single("imagem"), (req, res) => {
  const cnpj = req.body.cnpj;
  const nomeArquivo = req.file.originalname;
  const caminho = path.join("imagens", cnpj, "produtos", nomeArquivo);

  // Se o arquivo já existia antes do upload, o multer já substituiu
  const existiaAntes = fs.existsSync(caminho);

  return res.json({
    status: existiaAntes ? "atualizado" : "salvo",
    caminho,
  });
});
/*
// 📸 Upload de imagem (com Multer)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const cnpj = req.params.cnpj;
    const pasta = path.join(__dirname, "imagens", cnpj, "produtos");

    fs.mkdirSync(pasta, { recursive: true }); // Cria diretório se não existir
    cb(null, pasta);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Usa o nome original do arquivo
  },
});

const upload = multer({ storage: storage });

app.post("/imagens/:cnpj/produtos", upload.single("imagem"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("Nenhuma imagem enviada.");
  }
  res.status(200).send("Imagem enviada com sucesso.");
});
*/
// Rotas do app
app.use("/clientes", clientesRoutes);
app.use("/vendas", vendasRoutes);
app.use("/produtos", produtosRoutes);
app.use("/carrinho", carrinhoRoutes);
app.use("/promocoes", promocoesRoutes);
app.use("/lojas", lojasRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/pix", pixRoutes);

// ✅ Webhook do Mercado Pago (notificações automáticas)
app.post("/webhooks", async (req, res) => {
  if (req.body?.data?.id) {
    const paymentId = req.body.data.id;
    const pagamento = await mercadopago.payment.findById(paymentId);
    const status = pagamento.body.status;
    const id = pagamento.body.external_reference;
    const bandeira = pagamento.body.payment_method_id;
    const tipo_id = pagamento.body.payment_type_id;
    const motivo = pagamento.body.status_detail;

    console.log("Pagamento:", {
      paymentId,
      status,
      id,
      motivo,
    });

    await dbPromise.query(
      "UPDATE vendas SET id_pagamento = ?, tipo_pagamento = ?, bandeira = ?, status = ?, st_pagamento = ? WHERE id_venda = ?",
      [paymentId, tipo_id, bandeira, status, "Pago", id]
    );
  }
  res.sendStatus(200);
});

// ✅ Rotas de retorno visual para testes via navegador
app.get("/pagamento/sucesso", (req, res) => {
  res.send("✅ Pagamento aprovado com sucesso!");
});

app.get("/pagamento/falha", (req, res) => {
  res.send("❌ Ocorreu um erro no pagamento.");
});

app.get("/pagamento/pendente", (req, res) => {
  res.send("⏳ Seu pagamento está pendente de aprovação.");
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
