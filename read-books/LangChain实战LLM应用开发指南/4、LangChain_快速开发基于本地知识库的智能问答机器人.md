大家好，欢迎继续学习 LangChain 实战课程。

上节课中，我们学习了 LangChain 的架构编排和安装，相信每个同学都已经能够在自己电脑上成功用 LangChain 调用模型了。

在继续深入学习 LangChain 的组件和模块前，我们先`从零开始构建一个实战项目`，亲身感受 LangChain 的强大之处，让大家对 LangChain 的各个模块都有个更具象的了解。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f4c67f77dff943a9a5303d721cba5990~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1720&h=948&s=133990&e=png&b=ffffff" alt=""  /></p>




## 项目介绍与实现方案

### 项目背景

相信大家都有这样的网购经验：买到一个不满意的东西，但看到购物平台上的“不支持 7 天无理由退货”，打电话给客服，客服也以“购买前已标注不支持无理由退货”为由拒绝退货，这个时候，就觉得自己理亏，暗自吃瘪。

但其实，消费者权益法中已经明确阐明了，只有极少数商品除外，大部分商品都是可以无理由退货的。换句话说，平台的不支持，只是霸王条款，我们直接 12315 投诉走一波，不出半天就有客服联系你退货了。


基于上述背景，我们要`开发一个精通消费者权益法的问答机器人`，我们再买到不满意的东西，直接问它退款的相关事宜，它就能给出最专业的“法律援助”，避免我们再花冤枉钱。


这个机器人，有两点关键的要求：

1.  能准确回答消费者权益的相关问题；
1.  对于用户输入的其他问题，不做回答。


为了实现以上要求，我们需要引入《消费者权益保护法》的相关内容，并在机器人回答时进行限制，只回答消费者权益相关的问题。



### 实现方案

简单讲，我们需要将《消费者权益保护法》的内容存入向量化数据库中，当进行提问时，先将问题到向量数据库中进行查询获取相关信息，再把问题和数据库中查到的信息一起输入到 LLM，生成最终答案。

下面给出整个实现的流程图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1667cfd43d5a41cd8bf1997a73def6e9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2212&h=882&s=133852&e=png&b=dfeefd" alt=""  /></p>


-   `loading`：**数据加载**。将相关法律文档加载到本地，并变成 LangChain 能够识别的形式。
-   `split`：**文本切割**。将原本的大文档切割成指定大小的文档块，方便后续的存储。
-   `storage`：**向量化存储**。将切割好的文档块进行向量化后，存入向量数据库中。
-   `retrieval（2、3.2）`：**数据检索**。在向量数据库查到并返回相关的文档块。
-   `input（4）`：**输入**。由用户输入的问题和数据库查到的结果组成，一起输给 LLM。
-   `output`：**输出**。LLM 做出回答。



在流程的每一步中，LangChain 都提供了相关的工具和组件，可以让我们轻松完成相关功能。





## 项目环境搭建

为了保证大家能够在本地运行课程中的实战代码，在第一个实战项目中，我带大家过一遍项目的环境搭建。

首先，确保大家本地安装了 Python 3.11 及以上版本。这一步就略过了。大家自行上网搜索安装。


接下来，我们使用 `pdm` 作为项目的包管理工具，用来管理项目依赖库，并避免对机器上其他 Python 项目的影响。前端同学可以类比为 Node.js 的 npm；后端同学可以类比为 Java 的 maven 或 Golang 的 go mod。


**pdm 安装**

我们可以使用 pipx 安装 pdm，所以，我们需要先安装 pipx。

```shell
pip install pipx
pipx install pdm
```


**pdm 初始化项目**

执行 `pdm init` 就会初始化一个项目。需要注意的是，初始化的时候，pdm 会把机器上已安装的所有 python 版本都扫描出来，所以需要注意选对 Python 版本（≥ 3.11）。

```shell
# pdm init
Creating a pyproject.toml for PDM...
Please enter the Python interpreter to use
0. /opt/homebrew/bin/python3 (3.11)
1. /opt/homebrew/bin/python3.12 (3.12)
4. /usr/bin/python2 (2.7)
Please select (0):
...
```


完成后，pdm 在当前目录生成文件`pyproject.toml`，并将刚才选择的信息写入。

```shell
[project]
name = "consumer_bot"
version = "0.1.0"
description = "Default template for PDM package"
authors = [
    {name = "huiwan_code", email = "xxx@163.com"},
]
dependencies = []
requires-python = "==3.11.*"
readme = "README.md"
license = {text = "MIT"}

[tool.pdm]
package-type = "application"
```


**安装项目依赖**

pdm 通过 `add` 命令安装项目依赖的库，以下列出我们本次项目需要的依赖，大家可以自行尝试安装一下：

```shell
# 举例：pdm add langchain==0.1.13
langchain==0.1.13
langchain-openai>=0.0.5
bs4>=0.0.2
chromadb>=0.4.22
langchainhub>=0.1.14
langserve>=0.0.41
sse-starlette>=2.0.0
```

  


**运行项目**

pdm 本质是通过在项目目录下创建一个对应 Python 的虚拟环境，来隔离其他项目的影响。上一步中安装的依赖也都在虚拟环境中，所以我们直接使用`python` 命令运行项目中的代码，是无法引用到安装的依赖的，我们需要使用的是项目对应虚拟环境的 python 去运行。

我们可以使用 pdm 提供的 `run` 命令来执行。比如我们项目目录下有个 `bot.py`代码文件。`pdm run bot.py`就会使用虚拟环境中的 python 去运行这个脚本。

至此，我们就搭建好了项目所需的环境，下一步，我们开始进行问答机器人的开发讲解。

  



## 数据处理



### 数据加载

消费者权益保护法的链接：https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm 。LangChain 提供了多种 document_loaders，用于加载不同类型的文档。这里我们使用`WebBaseLoader`，搭配 `bs4` 库（html 数据提取库），来获取我们需要的内容。


打开上面链接，右键→ 检查元素。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/980e008f0688480e82befe3a8a01d7d2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2426&h=1390&s=400383&e=png&b=cad9ef" alt=""  /></p>


可以发现，我们需要的文档内容都在`class = "p1"`标签下面。加载代码如下：


```python
import bs4
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader(
    web_path="https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm",
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(
            class_=("p1")
        ))
)
docs = loader.load()
```


-   `web_path`指定了目标链接；
-   `bs_kwargs`代表 bs4 的一些配置，这里我们只获取 `class = "p1"`节点下的内容。


下面是打印 `docs` 的部分内容：

```shell
[Document(page_content='\n\xa0\xa0\xa0\xa0新华社北京10月...',metadata={'source': 'https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm'})]
```


LangChain 将拉取的内容封装在`Document`对象中，该对象包括`page_content`文档内容和`metadata`元信息两部分。



### 文本切割

在前面[《大语言模型 AI 未来号，启航了！》](https://juejin.cn/book/7352849785881591823/section/7352899219759300608)那篇文章中我们提到过，模型对 token 数量有限制，如果直接将整个原始文档加入上下文，容易超出模型的限制，而且模型在大量的输入中也比较难找到关键的信息，所以，我们需要将原始文档切割成多个小文档块，这里我们选用 LangChain 的`RecursiveCharacterTextSplitter`来切割文本。

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
splits = text_splitter.split_documents(docs)
```

-   `chunk_size`：文档块的最大尺寸。
-   `chunk_overlap`：文档块之间的重叠量，文档之间的内容重叠，有利于保持文档之间上下文的连续性。


上面代码中，我们将大文档拆分成 1000 个字符的文档块，每个文档块之间有 200 个字符的重叠。

下面是分割的效果：

```python
len(splits)
#> 11
len(splits[0].page_content)
#> 894
```


### 向量化存储

现在，我们已经解析并拆分得到了 11 个数据块，为了避免每次检索时都重新解析获取，需要将这些数据块存入数据库，使用时直接查询数据库即可。


我们这里使用向量数据库对数据进行存储和查询，向量数据库通过将数据转换为向量结构，能够高效地处理相似性搜索和聚类等任务。


想象一下，一本书有作者、分类、价格、出版时间、出版社等多个属性，向量数据库将每本书表示为一个向量，比如 [(3,4,2,1,6),(3,4,2,1,2)]，其中每个数字代表某个特征的值。我们给定书本，查询与该书类似的其他书。向量数据库会先转换指定书本为向量，查询并返回与该向量最相似的其他书本向量。


将数据存入向量数据库，我们需要先将数据进行向量化，或者称为“数据嵌入”。同样的，LangChain 集成了多种类型的嵌入方式，我们这里使用`OpenAIEmbeddings`。该嵌入方式默认使用 OpenAI 的`text-embedding-ada-002`模型进行数据嵌入，使用时我们需要提前设置 OPENAI_API_KEY 密钥。

随着 LLM 大模型的火热，向量数据库也发展迅速，市面上向量数据库种类众多。这里我们选择 Chroma。Chroma 开源免费，可以本地部署，安装和使用足够简单。我们直接 `pdm add` 进行安装。


```shell
 pdm add chromadb
```


现在，我们看看如何将数据块嵌入转换成向量，并存入 Chroma 中。

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

db = Chroma.from_documents(documents=splits, embedding=OpenAIEmbeddings(), persist_directory="./chroma_db")
```



-   `documents`：上一步切割后的文档块列表。
-   `embedding`：嵌入函数，这里我们使用 OpenAI 的`OpenAIEmbeddings`。
-   `persist_directory`：数据存储的目录。


执行代码后，会在项目目录下自动生成了`chroma_db`目录，存放着向量化后的数据。


下面再贴下数据处理的完整代码：

```python
import bs4
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

loader = WebBaseLoader(
    web_path="https://www.gov.cn/jrzg/2013-10/25/content_2515601.htm",
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(
            class_=("p1")
        ))
)

docs = loader.load()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
splits = text_splitter.split_documents(docs)
db = Chroma.from_documents(documents=splits, embedding=OpenAIEmbeddings(), persist_directory="./chroma_db")
```






## 创建问答机器人

准备好数据后，我们就可以开始构建我们的问答机器人了。主要流程为：根据问题在向量数据库中检索相关的文档知识，将这些知识信息作为上下文与问题一起传给 LLM，生成问题的答案。


### 提示词模板

LLM 是由提示词驱动执行的，提示词的好坏很大程度影响了回答的质量。再回想下我们对机器人的要求：

1.  根据消费者权益保护法的内容，回答相关问题；
1.  对于用户输入的其他问题，不做回答。


下面是 LangChain 提供的一个 RAG 通用提示词模板：

```python
"""
You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.

Question: {question} 

Context: {context} 

Answer:
"""
```

  


翻译成中文：


```python
你是问答任务的助手。使用以下检索到的上下文来回答问题。如果你不知道答案，就说你不知道。最多使用三个句子并保持答案简洁。
问题: {question}
上下文: {context}
答案:
```


该提示词模板包含`question`和`context`两个输入变量。`question`传入用户的问题，`context`传入从向量数据库中获取到的相关知识。

LangChain 提供`PromptTemplate`类用来构造最终的 prompt，所以，我们需要用上面的模板字符串实例化一个`PromptTemplate`对象。


```python
from langchain.prompts.prompt import PromptTemplate

prompt_template_str = """
You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.

Question: {question} 

Context: {context} 

Answer:
"""
prompt_template = PromptTemplate.from_template(prompt_template_str)
```



### 数据检索

接下来，我们需要考虑如何填充提示词模板中的 context 了。

在数据处理篇章中，我们使用`OpenAIEmbeddings`将数据向量化后存入 Chroma 中，查询数据时，我们也需要先实例化一个 LangChain 封装后的`Chroma`对象，指定数据存储位置以及数据的嵌入方法。


```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=OpenAIEmbeddings())
```



LangChain 为数据检索设计了`BaseRetriever`检索器类，统一了检索的接口。上述的`Chroma`对象可以通过`as_retriever`方法获取到对应的检索器实例。


```python
retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 4})
```


-   `search_type`：指定检索类型，`similarity`表示使用**相似性搜索**进行查询。
-   `search_kwargs`：搜索选项，`k:4`表示每次查询返回最符合条件的前 4 个文档。


```python
docs = retriever.invoke("发生争议如何解决？")
len(docs)
#> 4
```

  


### 创建问答链

现在，一切准备就绪，我们可以将上面的内容串联起来，构建我们的问答链了，建链的最终代码如下：


```python
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt_template
    | llm
    | StrOutputParser()
)
```


第一次看这种管道式的语法可能会比较懵，我们直接用下图阐述整个链的执行流程：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/697f619535f2464aaab1e7a3ffcf8397~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2784&h=952&s=154465&e=png&b=ffffff" alt=""  /></p>

`retriever`位于整个链的第一跳，所以，用户输入的问题 `question`会默认传给`retriever`，查询向量数据库获取到文档列表，将列表传给 `format_docs`，转换成 LLM 可以接收的字符串类型，并将其赋值给 `context`。`RunnablePassthrough`表示上一跳的输出，因为当前处于第一跳，所以`RunnablePassthrough()`会得到用户输入的问题，赋值给变量 `question`。现在，我们已经获取了提示词模板需要的两个变量。


我们使用这两个变量和提示词模板实例构造最终的提示词 `prompt`，传给 `llm`，LLM 生成答案后，将答案传给输出解析器`StrOutputParser`，该解析器会对答案进行格式化，然后输出最终的结果。




### 部署 LLM 应用

终于到了最后一步，构建好问答链后，我们就可以利用 LangServe 将 LLM 应用部署发布给用户调用。

```python
from fastapi import FastAPI
from langserve import add_routes
app = FastAPI(
  title="消费者权益智能助手",
  version="1.0",
)
# 3. Adding chain route
add_routes(
    app,
    rag_chain,
    path="/consumer_ai",
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
```



上述代码中，web 服务监听的是 localhost，也就是仅本机可访问，如果需要服务被公网可访问，需要将 host 改为服务器的公网 ip。

下面是问答机器人的完整代码`bot.py`：

  


```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_community.vectorstores import Chroma
from langchain_openai import ChatOpenAI,OpenAIEmbeddings
from langchain.prompts.prompt import PromptTemplate
from fastapi import FastAPI
from langserve import add_routes

vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=OpenAIEmbeddings())
retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 4})
prompt_template_str = """
You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.

Question: {question} 

Context: {context} 

Answer:
"""
prompt_template = PromptTemplate.from_template(prompt_template_str)

llm = ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt_template
    | llm
    | StrOutputParser()
)
app = FastAPI(
  title="消费者权益智能助手",
  version="1.0",
)
# 3. Adding chain route
add_routes(
    app,
    rag_chain,
    path="/consumer_ai",
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
```



现在，让我们把服务跑起来看看效果，执行 `pdm run bot.py`：


```shell
# pdm run bot.py
LANGSERVE: Playground for chain "/consumer_ai/" is live at:
LANGSERVE:  │
LANGSERVE:  └──> /consumer_ai/playground/
LANGSERVE:
LANGSERVE: See all available routes at /docs/

INFO:     Application startup complete.
INFO:     Uvicorn running on http://localhost:8000 (Press CTRL+C to quit)
```



在浏览器上访问 `http://localhost:8000/consumer_ai/playground/`：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3322bce42bd14edaa2c1a357e850aaa2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1920&h=1310&s=304585&e=png&b=f4f8fb" alt=""  /></p>



展开`intermediate steps`，还可以看到链的执行过程。

如果输入与文档内容无关的问题，机器人会拒绝回答。


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e3094dbe2fb34eac8c7b705ed766d171~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1890&h=1136&s=157256&e=png&b=f5f9fc" alt=""  /></p>

  


## 总结

今天，我们从 0 到 1 开发了一个现实可用的问答机器人，可以看到，从数据加载、存储，再到 LLM 的调用，LangChain 提供了 “一站式解决方案”，总共不到 100 行代码。相信这个示例能够让你了解到 LangChain 的威力和魅力。


后续的课程中，我们将深入学习 LangChain 各个模块和组件，一起探寻 LangChain 框架的奇妙。