// Script para inicialização do MongoDB
// Este script cria um usuário específico para a aplicação com permissões apenas no banco de dados necessário

db = db.getSiblingDB('extratos_portuarios');

// Criar coleções necessárias
db.createCollection('extratos');

// Criar índices para otimização de consultas
db.extratos.createIndex({ "matricula": 1, "mes": 1, "ano": 1 }, { unique: true });
db.extratos.createIndex({ "nome": 1 });
db.extratos.createIndex({ "categoria": 1 });

// Criar usuário para a aplicação
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'extratos_portuarios'
    }
  ]
});

console.log('Inicialização do MongoDB concluída com sucesso!');
