from flask import Flask, request, jsonify, send_file
import sqlite3
from flask_cors import CORS
import pandas as pd
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}

# Criar pasta de uploads se não existir
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db_connection():
    conn = sqlite3.connect('KanbanProjeto/kanban.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Criar tabelas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS etapa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            setor TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ordem_producao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            OS INTEGER NOT NULL,
            produto TEXT NOT NULL,
            estampa TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            data_entrega TEXT NOT NULL,
            cliente_final TEXT,
            etapa_id INTEGER,
            FOREIGN KEY(etapa_id) REFERENCES etapa(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            etapa_id INTEGER,
            producao_media INTEGER NOT NULL,
            FOREIGN KEY(etapa_id) REFERENCES etapa(id)
        )
    ''')

    cursor.execute('''
        INSERT OR IGNORE INTO etapa (nome, setor) VALUES 
            ('OS no email', 'Inicio'),
            ('OS na fabrica', 'Inicio'),
            ('Producao', 'Producao'),
            ('Bainha lencol', 'Producao'),
            ('Bainha fronha', 'Producao'),
            ('Fechar fronha', 'Producao'),
            ('Elastico', 'Producao'),
            ('Cortar canto', 'Producao'),
            ('Embalagem', 'Expedicao'),
            ('Romaneio', 'Expedicao'),
            ('Entregue', 'Fim'),
            ('Cancelado', 'Fim')
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordem_id INTEGER NOT NULL,
            etapa_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            status TEXT DEFAULT 'pendente',
            data_criacao TEXT DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(ordem_id) REFERENCES ordem_producao(id),
            FOREIGN KEY(etapa_id) REFERENCES etapa(id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Adicione esta função para criar a tabela de tarefas

@app.route('/produtos', methods=['POST'])
def adicionar_produto():
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # First, get the etapa_id for the given stage name
    cursor.execute('SELECT id FROM etapa WHERE nome = ?', (data.get('etapa', 'Não atribuido'),))
    etapa_result = cursor.fetchone()
    
    if etapa_result is None:
        conn.close()
        return jsonify({'error': 'Etapa não encontrada'}), 400
        
    etapa_id = etapa_result['id']
    
    cursor.execute('''
        INSERT INTO ordem_producao (OS, produto, estampa, quantidade, data_entrega, cliente_final, etapa_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (data['OS'], data['produto'], data['estampa'], data['quantidade'], 
          data['data_entrega'], data.get('cliente_final', ''), etapa_id))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Produto adicionado'}), 201

@app.route('/funcionarios', methods=['POST'])
def adicionar_funcionario():
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Primeiro, pega o etapa_id baseado no nome da etapa
    cursor.execute('SELECT id FROM etapa WHERE nome = ?', (data.get('etapa', 'Não atribuido'),))
    etapa_result = cursor.fetchone()
    
    if etapa_result is None:
        conn.close()
        return jsonify({'error': 'Etapa não encontrada'}), 400
        
    etapa_id = etapa_result['id']
    
    cursor.execute('''
        INSERT INTO funcionarios (nome, etapa_id, producao_media) 
        VALUES (?, ?, ?)
    ''', (data['nome'], etapa_id, data['producao_media']))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Funcionário adicionado'}), 201
    

@app.route('/produtos', methods=['GET'])
def listar_produtos():
    conn = get_db_connection()
    cursor = conn.cursor()
    produtos = cursor.execute('''
        SELECT op.*, e.nome as etapa_nome, e.id as etapa_id
        FROM ordem_producao op
        LEFT JOIN etapa e ON op.etapa_id = e.id
    ''').fetchall()
    conn.close()
    return jsonify([{
        "id": row["id"], 
        "produto": row["produto"], 
        "estampa": row["estampa"],
        "quantidade": row["quantidade"], 
        "OS": row["OS"],
        "data_entrega": row["data_entrega"],
        "cliente_final": row["cliente_final"] if "cliente_final" in row.keys() else "",
        "etapa": row["etapa_nome"] or "OS no email",
        "etapa_id": row["etapa_id"]
    } for row in produtos])


@app.route('/funcionarios', methods=['GET'])
def listar_funcionarios():
    conn = get_db_connection()
    cursor = conn.cursor()
    funcionarios = cursor.execute('''
        SELECT f.id, f.nome, e.nome AS etapa, e.id AS etapa_id, f.producao_media 
        FROM funcionarios f
        LEFT JOIN etapa e ON f.etapa_id = e.id
    ''').fetchall()
    conn.close()
    return jsonify([{
        "id": row["id"], 
        "nome": row["nome"], 
        "etapa": row["etapa"] or "OS no email",
        "etapa_id": row["etapa_id"],
        "producao_media": row["producao_media"]
    } for row in funcionarios])

@app.route('/etapas', methods=['GET'])
def listar_etapas():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query que calcula ambas as capacidades para cada etapa
    etapas = cursor.execute('''
        SELECT 
            e.id,
            e.nome,
            e.setor,
            COALESCE(SUM(o.quantidade), 0) as capacidade_necessaria,
            COALESCE(SUM(f.producao_media), 0) as capacidade_alocada
        FROM etapa e
        LEFT JOIN ordem_producao o ON e.id = o.etapa_id
        LEFT JOIN funcionarios f ON e.id = f.etapa_id
        GROUP BY e.id, e.nome, e.setor
        ORDER BY e.id
    ''').fetchall()
    
    conn.close()
    
    return jsonify([{
        "id": row["id"],
        "nome": row["nome"],
        "setor": row["setor"],
        "capacidade_necessaria": row["capacidade_necessaria"],
        "capacidade_alocada": row["capacidade_alocada"],
        "status": "Sobrecarregado" if row["capacidade_necessaria"] > row["capacidade_alocada"] 
                 else "Ocioso" if row["capacidade_necessaria"] < row["capacidade_alocada"]
                 else "Balanceado"
    } for row in etapas])

# Opcional: Rota para obter detalhes de uma etapa específica
@app.route('/etapas/<int:etapa_id>', methods=['GET'])
def detalhe_etapa(etapa_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Busca informações básicas da etapa
    etapa = cursor.execute('''
        SELECT 
            e.id,
            e.nome,
            e.setor,
            COALESCE(SUM(o.quantidade), 0) as capacidade_necessaria,
            COALESCE(SUM(f.producao_media), 0) as capacidade_alocada
        FROM etapa e
        LEFT JOIN ordem_producao o ON e.id = o.etapa_id
        LEFT JOIN funcionarios f ON e.id = f.etapa_id
        WHERE e.id = ?
        GROUP BY e.id, e.nome, e.setor
    ''', (etapa_id,)).fetchone()
    
    if etapa is None:
        return jsonify({"error": "Etapa não encontrada"}), 404
    
    # Busca ordens desta etapa
    ordens = cursor.execute('''
        SELECT id, produto, quantidade, data_entrega
        FROM ordem_producao
        WHERE etapa_id = ?
    ''', (etapa_id,)).fetchall()
    
    # Busca funcionários desta etapa
    funcionarios = cursor.execute('''
        SELECT id, nome, producao_media
        FROM funcionarios
        WHERE etapa_id = ?
    ''', (etapa_id,)).fetchall()
    
    conn.close()
    
    return jsonify({
        "id": etapa["id"],
        "nome": etapa["nome"],
        "setor": etapa["setor"],
        "capacidade_necessaria": etapa["capacidade_necessaria"],
        "capacidade_alocada": etapa["capacidade_alocada"],
        "status": "Sobrecarregado" if etapa["capacidade_necessaria"] > etapa["capacidade_alocada"]
                 else "Ocioso" if etapa["capacidade_necessaria"] < etapa["capacidade_alocada"]
                 else "Balanceado",
        "ordens": [{
            "id": ordem["id"],
            "produto": ordem["produto"],
            "quantidade": ordem["quantidade"],
            "data_entrega": ordem["data_entrega"]
        } for ordem in ordens],
        "funcionarios": [{
            "id": func["id"],
            "nome": func["nome"],
            "producao_media": func["producao_media"]
        } for func in funcionarios]
    })

@app.route('/produtos/<int:produto_id>', methods=['PATCH'])
def atualizar_produto(produto_id):
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE ordem_producao 
        SET etapa_id = ? 
        WHERE id = ?
    ''', (data['etapa_id'], produto_id))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Produto atualizado com sucesso'})

@app.route('/importar/funcionarios', methods=['POST'])
def importar_funcionarios():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Ler o arquivo Excel
            df = pd.read_excel(filepath)
            
            # Verificar se as colunas necessárias existem
            required_columns = ['nome', 'etapa', 'producao_media']
            if not all(col in df.columns for col in required_columns):
                return jsonify({'error': 'O arquivo deve conter as colunas: nome, etapa, producao_media'}), 400
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Contador de registros inseridos
            inserted_count = 0
            errors = []
            
            for _, row in df.iterrows():
                try:
                    # Obter o ID da etapa
                    cursor.execute('SELECT id FROM etapa WHERE nome = ?', (row['etapa'],))
                    etapa_result = cursor.fetchone()
                    
                    if etapa_result is None:
                        errors.append(f"Etapa '{row['etapa']}' não encontrada para funcionário '{row['nome']}'")
                        continue
                    
                    etapa_id = etapa_result['id']
                    
                    # Inserir funcionário
                    cursor.execute('''
                        INSERT INTO funcionarios (nome, etapa_id, producao_media) 
                        VALUES (?, ?, ?)
                    ''', (row['nome'], etapa_id, row['producao_media']))
                    
                    inserted_count += 1
                except Exception as e:
                    errors.append(f"Erro ao inserir funcionário '{row['nome']}': {str(e)}")
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'message': f'{inserted_count} funcionários importados com sucesso',
                'errors': errors
            }), 201
            
        except Exception as e:
            return jsonify({'error': f'Erro ao processar o arquivo: {str(e)}'}), 500
        finally:
            # Remover o arquivo após processamento
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({'error': 'Tipo de arquivo não permitido'}), 400

@app.route('/importar/produtos', methods=['POST'])
def importar_produtos():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Ler o arquivo Excel diretamente do objeto file
            df = pd.read_excel(file)
            
            # Verificar se as colunas necessárias existem
            required_columns = ['OS', 'produto', 'estampa', 'quantidade', 'data_entrega', 'etapa']
            if not all(col in df.columns for col in required_columns):
                return jsonify({'error': 'O arquivo deve conter as colunas: OS, produto, estampa, quantidade, data_entrega, etapa'}), 400
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Contador de registros inseridos
            inserted_count = 0
            errors = []
            
            for _, row in df.iterrows():
                try:
                    # Verificar se a OS já existe
                    cursor.execute('SELECT id FROM ordem_producao WHERE OS = ?', (row['OS'],))
                    os_exists = cursor.fetchone()
                    
                    if os_exists:
                        errors.append(f"OS '{row['OS']}' já existe no sistema. Não é possível duplicar.")
                        continue
                    
                    # Obter o ID da etapa
                    cursor.execute('SELECT id FROM etapa WHERE nome = ?', (row['etapa'],))
                    etapa_result = cursor.fetchone()
                    
                    if etapa_result is None:
                        errors.append(f"Etapa '{row['etapa']}' não encontrada para produto '{row['produto']}'")
                        continue
                    
                    etapa_id = etapa_result['id']
                    
                    # Verificar se a coluna cliente_final existe no DataFrame
                    cliente_final = row.get('cliente_final', '') if 'cliente_final' in row else ''
                    
                    # Inserir produto
                    cursor.execute('''
                        INSERT INTO ordem_producao (OS, produto, estampa, quantidade, data_entrega, cliente_final, etapa_id) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (row['OS'], row['produto'], row['estampa'], row['quantidade'], 
                          row['data_entrega'], cliente_final, etapa_id))
                    
                    inserted_count += 1
                except Exception as e:
                    errors.append(f"Erro ao inserir produto '{row['produto']}': {str(e)}")
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'message': f'{inserted_count} produtos importados com sucesso',
                'errors': errors
            }), 201
            
        except Exception as e:
            return jsonify({'error': f'Erro ao processar o arquivo: {str(e)}'}), 500
    
    return jsonify({'error': 'Tipo de arquivo não permitido'}), 400

@app.route('/template/funcionarios', methods=['GET'])
def template_funcionarios():
    # Criar um DataFrame de exemplo
    df = pd.DataFrame({
        'nome': ['Nome do Funcionário'],
        'etapa': ['Nome da Etapa'],
        'producao_media': [100]
    })
    
    # Garantir que a pasta existe
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    # Salvar como Excel
    template_path = os.path.join(UPLOAD_FOLDER, 'template_funcionarios.xlsx')
    df.to_excel(template_path, index=False)
    
    return send_file(template_path, as_attachment=True, download_name='template_funcionarios.xlsx')

@app.route('/template/produtos', methods=['GET'])
def template_produtos():
    # Criar um DataFrame de exemplo
    df = pd.DataFrame({
        'OS': [1001],
        'produto': ['Nome do Produto'],
        'estampa': ['Descrição da Estampa'],
        'quantidade': [100],
        'data_entrega': ['2023-12-31'],
        'cliente_final': ['Nome do Cliente'],
        'etapa': ['Nome da Etapa']
    })
    
    # Criar um buffer de memória
    from io import BytesIO
    buffer = BytesIO()
    
    # Salvar o DataFrame no buffer
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    
    # Mover o cursor para o início do buffer
    buffer.seek(0)
    
    # Enviar o arquivo diretamente da memória
    return send_file(
        buffer,
        as_attachment=True,
        download_name='template_produtos.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@app.route('/tarefas', methods=['GET'])
def listar_tarefas():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    tarefas = cursor.execute('''
        SELECT t.*, e.nome as etapa_nome, op.OS, op.produto
        FROM tarefas t
        JOIN etapa e ON t.etapa_id = e.id
        JOIN ordem_producao op ON t.ordem_id = op.id
    ''').fetchall()
    
    conn.close()
    
    return jsonify([{
        "id": row["id"],
        "ordem_id": row["ordem_id"],
        "OS": row["OS"],
        "produto": row["produto"],
        "etapa_id": row["etapa_id"],
        "etapa_nome": row["etapa_nome"],
        "descricao": row["descricao"],
        "quantidade": row["quantidade"],
        "status": row["status"],
        "data_criacao": row["data_criacao"],
        "data_atualizacao": row["data_atualizacao"]
    } for row in tarefas])

@app.route('/produtos/<int:produto_id>/tarefas', methods=['GET'])
def listar_tarefas_ordem(produto_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    tarefas = cursor.execute('''
        SELECT t.*, e.nome as etapa_nome
        FROM tarefas t
        JOIN etapa e ON t.etapa_id = e.id
        WHERE t.ordem_id = ?
    ''', (produto_id,)).fetchall()
    
    conn.close()
    
    return jsonify([{
        "id": row["id"],
        "ordem_id": row["ordem_id"],
        "etapa_id": row["etapa_id"],
        "etapa_nome": row["etapa_nome"],
        "descricao": row["descricao"],
        "quantidade": row["quantidade"],
        "status": row["status"],
        "data_criacao": row["data_criacao"],
        "data_atualizacao": row["data_atualizacao"]
    } for row in tarefas])

@app.route('/produtos/<int:produto_id>/tarefas', methods=['POST'])
def criar_tarefas_ordem(produto_id):
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a ordem existe
    cursor.execute('SELECT * FROM ordem_producao WHERE id = ?', (produto_id,))
    ordem = cursor.fetchone()
    
    if not ordem:
        conn.close()
        return jsonify({'error': 'Ordem de produção não encontrada'}), 404
    
    tarefas_criadas = []
    
    for tarefa_data in data:
        # Verificar se a etapa existe
        cursor.execute('SELECT * FROM etapa WHERE id = ?', (tarefa_data.get('etapa_id'),))
        etapa = cursor.fetchone()
        
        if not etapa:
            conn.close()
            return jsonify({'error': f'Etapa {tarefa_data.get("etapa_id")} não encontrada'}), 404
        
        # Inserir a tarefa
        cursor.execute('''
            INSERT INTO tarefas (ordem_id, etapa_id, descricao, quantidade, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            produto_id,
            tarefa_data.get('etapa_id'),
            tarefa_data.get('descricao'),
            tarefa_data.get('quantidade', ordem['quantidade']),
            'pendente'
        ))
        
        tarefa_id = cursor.lastrowid
        
        # Buscar a tarefa recém-criada
        cursor.execute('''
            SELECT t.*, e.nome as etapa_nome
            FROM tarefas t
            JOIN etapa e ON t.etapa_id = e.id
            WHERE t.id = ?
        ''', (tarefa_id,))
        
        tarefa = cursor.fetchone()
        tarefas_criadas.append({
            "id": tarefa["id"],
            "ordem_id": tarefa["ordem_id"],
            "etapa_id": tarefa["etapa_id"],
            "etapa_nome": tarefa["etapa_nome"],
            "descricao": tarefa["descricao"],
            "quantidade": tarefa["quantidade"],
            "status": tarefa["status"],
            "data_criacao": tarefa["data_criacao"],
            "data_atualizacao": tarefa["data_atualizacao"]
        })
    
    conn.commit()
    conn.close()
    
    return jsonify(tarefas_criadas), 201

@app.route('/tarefas/<int:tarefa_id>', methods=['PUT'])
def atualizar_tarefa(tarefa_id):
    data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a tarefa existe
    cursor.execute('SELECT * FROM tarefas WHERE id = ?', (tarefa_id,))
    tarefa = cursor.fetchone()
    
    if not tarefa:
        conn.close()
        return jsonify({'error': 'Tarefa não encontrada'}), 404
    
    # Campos que podem ser atualizados
    campos_atualizaveis = ['status', 'etapa_id', 'quantidade', 'descricao']
    campos_atualizados = []
    valores_atualizados = []
    
    for campo in campos_atualizaveis:
        if campo in data:
            campos_atualizados.append(f"{campo} = ?")
            valores_atualizados.append(data[campo])
    
    if not campos_atualizados:
        conn.close()
        return jsonify({'error': 'Nenhum campo para atualizar'}), 400
    
    # Adicionar data de atualização
    campos_atualizados.append("data_atualizacao = CURRENT_TIMESTAMP")
    
    # Construir a query de atualização
    query = f'''
        UPDATE tarefas
        SET {', '.join(campos_atualizados)}
        WHERE id = ?
    '''
    
    # Adicionar o ID da tarefa aos valores
    valores_atualizados.append(tarefa_id)
    
    cursor.execute(query, valores_atualizados)
    
    # Buscar a tarefa atualizada
    cursor.execute('''
        SELECT t.*, e.nome as etapa_nome
        FROM tarefas t
        JOIN etapa e ON t.etapa_id = e.id
        WHERE t.id = ?
    ''', (tarefa_id,))
    
    tarefa_atualizada = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": tarefa_atualizada["id"],
        "ordem_id": tarefa_atualizada["ordem_id"],
        "etapa_id": tarefa_atualizada["etapa_id"],
        "etapa_nome": tarefa_atualizada["etapa_nome"],
        "descricao": tarefa_atualizada["descricao"],
        "quantidade": tarefa_atualizada["quantidade"],
        "status": tarefa_atualizada["status"],
        "data_criacao": tarefa_atualizada["data_criacao"],
        "data_atualizacao": tarefa_atualizada["data_atualizacao"]
    })

@app.route('/etapas/<int:etapa_id>/tarefas', methods=['GET'])
def listar_tarefas_etapa(etapa_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    tarefas = cursor.execute('''
        SELECT t.*, e.nome as etapa_nome, op.OS, op.produto, op.estampa, op.data_entrega
        FROM tarefas t
        JOIN etapa e ON t.etapa_id = e.id
        JOIN ordem_producao op ON t.ordem_id = op.id
        WHERE t.etapa_id = ? AND t.status != 'concluido'
    ''', (etapa_id,)).fetchall()
    
    conn.close()
    
    return jsonify([{
        "id": row["id"],
        "ordem_id": row["ordem_id"],
        "OS": row["OS"],
        "produto": row["produto"],
        "estampa": row["estampa"],
        "data_entrega": row["data_entrega"],
        "etapa_id": row["etapa_id"],
        "etapa_nome": row["etapa_nome"],
        "descricao": row["descricao"],
        "quantidade": row["quantidade"],
        "status": row["status"],
        "data_criacao": row["data_criacao"],
        "data_atualizacao": row["data_atualizacao"]
    } for row in tarefas])

def initialize_app():
    import os
    db_path = 'KanbanProjeto/kanban.db'
    if not os.path.exists(db_path):
        init_db()


if __name__ == '__main__':
    initialize_app()
    app.run(debug=True)