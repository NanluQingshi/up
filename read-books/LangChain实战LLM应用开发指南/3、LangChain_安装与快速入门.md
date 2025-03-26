大家好，欢迎继续学习 LangChain 实战课程。

上节课我们简单介绍了大语言模型的发展历程和一些相关的基础概念和知识，现在开始，我们正式学习 LangChain 框架。

LangChain 是目前最活跃的开源 LLM 应用开发框架，社区活跃，迭代迅速。截至目前，已经超过 75k 的 star，超过 2000 位开发者参与贡献，超过 50k 个项目依赖了 LangChain 框架，这些数字从一定程度上表示了大家对 LangChain 的肯定和未来潜力的认可。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1bebe97de80646aba92d8f4ac7d5e638~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1280&h=924&s=136506&e=png&b=ffffff" alt=""  /></p>


在这节课，我们将会学到使用 LangChain 框架进行开发的必要性，初步了解 LangChain 的 6 个模块，并带大家安装和快速使用 LangChain，最后，还会简单介绍如何使用 LangServe 快速部署和发布我们的 LLM 应用。相关思维导图如下：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2f48d161799342a6a865e60a79911c55~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1906&h=1118&s=172680&e=png&b=ffffff" alt=""  /></p>

  


## 为什么需要 LangChain

先举一个后端同学比较熟悉的开发场景：我们维护一个商城系统中的后端支付模块，新接入一个支付渠道，我们后端开发需要先跟渠道接口对接，再与前端同学协商好新协议进行对接。如下图所示：


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1b6e52296226401989f04d9e236b00c4~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1622&h=1022&s=97446&e=png&b=ffffff" alt=""  /></p>


上面的架构有点繁琐，因为在后端和前端的交互中，无非是前端调用下单接口创建订单 → 用户支付 → 后端获取订单状态，并不需要每个支付渠道都新设计一套协议。所以，我们可以抽象出一套`后端↔前端通用对接协议`，这一层也称为抽象接口层。无论哪个支付渠道，前端都能使用这套协议进行对接。优化后的架构如下：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d26a8baaa28444497b7e9104bb6b534~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1722&h=980&s=93063&e=png&b=ffffff" alt=""  /></p>


类比到 LLM 应用开发场景，支付渠道就好比是众多的预训练大语言模型，而对接了多个支付渠道，并对外提供抽象接口层的支付中台，就是 LangChain。


LangChain 集成了 OpenAI、Hugging Face、Google 等多个平台的多个大语言模型，并提供了统一的调用方式，我们不再需要关注和学习每个平台不同的调用方式，这使得我们切换一个新的大语言模型的成本非常低，通常只要修改一两行代码，就能无缝切换。


另外，LangChain 提供了一系列的组件和工具，涵盖了数据读取、数据存储、模型交互、应用发布等各个环节。以数据读取举例，LangChain 支持 CSV、JSON、Markdown、PDF 等多种文件格式的写入，有时我们需要写入一个 url 的内容，LangChain 有 Google、YouTube，甚至是 bilibili 等常见网站的内容提取库。LangChain 好比一把“瑞士军刀”，开发过程中遇到什么问题，可以先到工具箱里找找是否已经提供了相应的工具。


不止于此，LangChain 提出的 Chain 和 Agent 的概念，进一步规范和简化了复杂 LLM 应用的开发。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/37233deb66b043179160581179c441ca~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1628&h=1120&s=132545&e=png&b=ffffff" alt=""  /></p>

所以，通过 LangChain，即使是一个非 AI 领域的开发者，也能够轻松地将各种大语言模型与外部数据结合起来，构建出真实可用的 LLM 应用。






## LangChain 的 6 大模块

为了满足各类开发场景，**LangChain 将整个框架分成了** **`6 大模块`**。这些模块涵盖了 LLM 应用开发过程中的各个环节，充分学习和理解这些模块，可以快速搭建可扩展的 LLM 应用。


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a49f1ec425a447069f1e177ae66720bd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2436&h=640&s=77726&e=png&b=ffffff" alt=""  /></p>



### 模型 IO（Model IO）

当前，各种大语言模型不断涌现，LangChain 将大语言模型分成了 `LLM Model` 和 `Chat Model` 两大类，分别为其提供了统一的输入和输出接口标准，简化了我们对大语言模型的调用。

LangChain 的提示词模板功能，方便我们管理和控制模型的输入。LangChain 内置有多个优秀的提示词模板，同时还有一个提示词模板社区（LangSmith-hub），满足了开发者各式各样的输入需求。


LangChain 还提供了输出解析器，帮助我们从模型的输出中提取和格式化所需的信息。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f250b827e1994cc1bf5e3c1810bd94ed~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=4000&h=1536&s=503848&e=png&b=f1fcf1" alt=""  /></p>

  


### 数据检索（Retrieval）

LLM 应用需要用到用户自己的数据，这些数据不在模型原本的训练集中，为了使模型能够正确回答相关的问题，需要在与模型交互时，先检索特定数据，将检索结果与问题一起传递给 LLM，这种方式称为**检索增强生成（RAG）**。


为了实现 RAG，需要将外部数据进行向量化存储和检索。LangChain 集成了多种处理平台，并提供了加载、转换、存储和查询数据的统一接口。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dc6b9d31ddfc4462a75f669a9e6d49a2~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=4256&h=1472&s=918890&e=png&b=e6fbea" alt=""  /></p>



### 链（Chain）

LangChain 提出使用链的方式来构建 LLM 应用，无论是大语言模型的调用、工具的使用还是数据的处理，都是链的一部分，我们可以像搭积木一样方便清晰地构建 LLM 应用。

LangChain 构建链的方式发生了一次重大的变更，新版本的 LangChain 使用一种 **LCEL（LangChain Expression Language）** 方式来创建链，如下图，该方式使用管道符（“|”）将链的各部分连接起来，整条链的构造和执行更直观和清晰。此外，还支持异步调用、流式输出等特性。LangChain 的开发者们还在努力迭代出每个功能链的 LCEL 版本，逐步替换掉旧版本的链构建方式。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f8d7d6c23e3a429c8a3e3677e9de9d01~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2428&h=950&s=231603&e=png&b=fafafa" alt=""  /></p>



### 记忆（Memory）

我们与模型的交互过程中，模型是不会以任何形式记录我们过去交互的信息的，比如上一回合你明确告诉模型你的名字，下一次交互中，模型还是不知道你的名字是什么，也就是说，模型本身并不具备记忆功能。

对于很多 LLM 应用，尤其是对话类机器人，能够关联历史聊天记录再做出回答，是应用的一个基础功能。LangChain 提供了多种工具，来为 LLM 应用添加“内存条”，实现记忆功能。这些工具可以单独使用，也可以无缝地合并到链中。




### 代理（Agent）

Yao 等人在 2022 年底提出了推理和行动（ReAct）框架，用于增强 LLM 的推理能力和行动能力。

LangChain 在此基础上，创建了 Agent。在链中，哪一步执行哪个组件或工具是固定的；而在 Agent 中，会使用大语言模型进行推理和决策，由大语言模型来决定执行哪些操作以及按何种顺序执行。



### 回调（Callback）

LangChain 提供了一个回调系统，允许你 hook 到链的各个阶段。这对于日志记录、监视、流式传输和其他任务非常有用。LangChain 内置了多种回调处理器，我们可以在运行链时将处理器对象传入 `callbacks`参数，订阅各个周期的事件。






## 开始使用 LangChain

LangChain 提供了 Python 和 JavaScript 两个开发版本。考虑到 LangChain 中 Python 的生态更完善，而且 Python 语法易读，无论是前端还是后端同学，都能很容易看懂，所以我们小册中使用 `Python` 版本进行讲解。


### LangChain 安装

自开源以来，LangChain 迭代迅速，一方面代表了 LangChain 框架的欢迎程度，但另一方面，频繁的更新和迭代，其中有一部分还有兼容性问题，加上 LangChain 此前所有版本都是 0.0.x，导致使用 LangChain 的开发者不敢随便升级版本，无法享受到高版本 LangChain 的新特性。

终于，在 2024 年 1 月份，LangChain 推出了 `0.1.0 版本`，这意味着有稳定版可以用于生产。未来的 LangChain 版本迭代都会基于以下版本标准：

1.  破坏原有接口设计，会导致兼容性问题的更新，会提升次要版本号（即版本号的第二个数字）；
2.  错误修复和新增功能会提升补丁版本号（即版本号的第三个数字）。



所以，我们课程的 LangChain 版本会基于 0.1.x（目前是 0.1.13），保证后续的代码案例大家也能在实践中运行成功。

根据 LangChain 推荐，我们 Python 版本选用 3.11，大家可以先自行安装 Python 3.11。


安装 LangChain 比较简单，直接 pip 安装即可。

```
pip install langchain==0.1.13
```

需要注意的是，虽然 LangChain 代码集成了各种语言模型、各种向量数据库及相关工具，但安装 Langchain 时，默认是没有安装相关的依赖库的。这意味着我们需要手动导入相关的依赖项。比如，我们课程主要使用 OpenAI 的大语言模型用作演示，所以还需要安装 langchain-openai。

```
pip install langchain-openai
```






### 开发密钥配置

通过 API 调用 OpenAI、Hugging face 等三方平台的大语言模型时，一般都需要一个调用密钥，密钥用于平台进行计费和鉴权。每个平台获取密钥的方式都不相同，我们以 OpenAI 为例。


#### 官方渠道获取密钥

1.  打开 OpenAI API key 配置后台：https://platform.openai.com/api-keys ，按相关提示先完成注册和登录流程。
2.  点击“Create new secret key”按钮，生成一个新的密钥。



<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/63e7c3cae13c4ab5834eebee68a5fddf~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2430&h=1306&s=294099&e=png&b=7f7f7f" alt=""  /></p>


这样我们就成功创建了一个官方的 OpenAI 的密钥。



#### 国内代理获取密钥

出于某些众所周知的原因，调用 OpenAI 的 API 需要魔法访问，而且， 密钥额度充值需要一张海外银行卡，这对于很多用户也有一定门槛。所以，国内催生了一批 OpenAI 密钥代理服务，我们在代理平台上购买密钥额度，使用代理平台给我们的密钥和代理 API 调用模型。代理 API 与官方 API 相比，一般只是 host 有区别，url 的 path 和 api 的传参都会与官方保持一致。


大家可以自行 Google 下 “openai key 购买”就能找到相关的代理服务，一般价格不贵。但代理平台的密钥，稳定性无法保证，说不定哪天代理平台就跑路了，所以建议一次不要购买太多的额度，同时，在学习和测试阶段使用就好，生产上还是想办法从官方渠道进行购买。



#### LangChain 使用密钥

在上一步中，我们获取到了密钥和调用模型的 API（官方或代理平台）。LangChain 支持两种方式进行设置使用。


方法 1：直接将密钥和调用 API 在初始化模型对象时传入。

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(openai_api_key="密钥", openai_api_base="调用api")
```

这是最直接但也是最不安全的做法，一旦代码被公开，密钥也会被泄露。



方法 2：使用环境变量。

```python
export OPENAI_API_KEY = "密钥"
export OPENAI_API_BASE = "调用api"
```


初始化模型对象时，不再需要指定密钥和 API，LangChain 会自动从环境变量中检测并使用。


```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI()
```


这是`比较推荐的写法`，因为密钥没有写在代码中，即使代码公开，密钥也不会泄露。


### LLM Model vs Chat Model

介绍 LangChain 6 大模块的时候提到过，LangChain 将大语言模型分成了 ` LLM Model  `和 `Chat Model`两大类，本小节我们来学习这两大类的区别以及在 LangChain 中分别是如何使用的。


#### LangChain 调用 LLM Model

LLM 模型主要用于文本补全、文本嵌入、文本相似度查找等文本工作。比如，输入文本：“今天天气真”，模型会补全文本内容，返回：“不错，温度适宜，风和日丽，适合出门”。这类模型一般接受一个字符串作为输入，再返回一个字符串。

LangChain 对 LLM 模型的调用比较简单，初始化时指定模型名称，运行时输入字符串即可。假设我们想使用 OpenAI 的 `gpt-3.5-turbo-instruct` 模型，示例如下：


```python
from langchain_openai import OpenAI
llm = OpenAI(model_name= 'gpt-3.5-turbo-instruct')
llm.invoke("今天天气真")
# > 不错,温度适宜,风和日丽,适合出门
```


值得一提的是，LangChain 的 OpenAI 类，默认用的就是 `gpt-3.5-turbo-instruct` 模型。


#### LangChain 调用 Chat Model

LLM Model 属于通用模型，一般用于简单的单轮文本交互，而 Chat Model 则是针对对话任务进行了优化，能够更好地进行与人之间的多轮对话，比如客服机器人、虚拟助手等。


Chat Model 输入和输出的不再是简单的字符串，而是`消息（Message）`；并引入了`角色`的概念，每条消息都有对应的角色。一般来说，角色分三种：


1.  `user`：用户消息。消息内容为用户输入的问题，在 LangChain 中，以`HumanMessage`表示。
2.  `assistant`：助手消息。消息内容是模型做出的回答，可以通过助手消息提供模型的历史回答，达到记忆对话的效果。在 LangChain 中以`AIMessage`表示。
3.  `system`：系统消息。用于设定对话的背景或上下文，可以帮助模型理解它在对话中的角色和任务，提高模型在对话中的回答质量。在 LangChain 中以`SystemMessage`表示。比如，让模型扮演一个高级开发工程师，可以`SystemMessage(content = "你是一个专业的高级开发工程师")`，这样能帮忙模型在对话中做出更好的回答。



  


Chat Model 接收一个消息列表作为输入，消息列表可以包含 1 个`SystemMessage`，多个`HumanMessage`和`AIMessage`，当然，最后一个需要是`HumanMessage`，填入用户期望回答的问题。LangChain将会输出一个`AIMessage`，作为问题的答案。



以下是一个 LangChain 调用 Chat Model 的一个示例：


```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
chat = ChatOpenAI()
input_messages = [
    SystemMessage(content="You're a helpful assistant"),
    HumanMessage(content="1+1=?"),
]
chat.invoke(input_messages)
# > AIMessage(content ="1 + 1 equals 2.")
```

  


## LangServe：快速部署你的 LLM 应用

当我们使用 Langchain 构建了应用程序后，下一步就是要部署发布给用户使用，Langchain 提供了 LangServe，与 Python 的 FastAPI Web 框架集成，可以很方便地部署我们的 AI 服务。


### 构建 LLM 应用

1.  pip 安装 LangServe：


```python
pip install "langserve[all]"
```


2.  初始化 FastAPI 应用：

```python
app = FastAPI(
  title="LangChain Server",
  version="1.0",
  description="A simple API server using LangChain's Runnable interfaces",
)
```


3.  定义服务的路由：

```python
langserve.add_routes(
    app,
    llm,
    path="/first_llm",
)
```

完整代码如下：

```python
import os
from langchain_openai import OpenAI
from fastapi import FastAPI
from langserve import add_routes

os.environ['OPENAI_API_KEY'] = '你的openai key'
os.environ['OPENAI_API_BASE'] = '你的代理url'
llm = OpenAI()
app = FastAPI(
  title="LangChain Server",
  version="1.0",
  description="A simple API server using LangChain's Runnable interfaces",
)
# 3. Adding chain route
add_routes(
    app,
    llm,
    path="/first_llm",
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
```


执行上面的 python 文件，我们就可以通过 localhost:8000 访问到我们的 AI 服务了。


### 浏览器调试

LangServe 还内置了一个用于调试输入输出的 UI，在浏览器上访问 `http://localhost:8000/first_llm/playground/`即可打开。


<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c8a47019d0d04edca04612a486ec04e8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1782&h=772&s=97989&e=png&b=f7fafc" alt=""  /></p>



### 远程调用应用

LangServe 提供了`RemoteRunnable`类，用于创建一个 client，用于远程调用服务端。

```python
from langserve import RemoteRunnable

remote_chain = RemoteRunnable("http://localhost:8000/first_llm/")
remote_chain.invoke({"text": "tell a joke"})
```






## 总结

最后，我们总结下本文的知识要点：

1.  LangChain 集成各个平台的众多大语言模型，并提供了丰富的组件和工具，通过模块化，建链的方式为应用开发者提供易用的 LLM 应用开发脚手架。
1.  LangChain 分为模型 IO、数据检索、链、记忆、代理、回调六大模块，这六大模块涵盖了 LLM 应用开发的各个环节。
1.  2024 年 1 月，LangChain 升级了 0.1.x 版本，并规范了后续的版本管理，我们应尽量使用 0.1.x 作为生产版本。
1.  在 LLM 应用开发过程中，应妥善管理好密钥，避免密钥泄露，推荐使用环境变量的方式配置密钥。
1.  LangChain 将大语言模型分为 LLM Model 和 Chat Model 两大类，两类模型在 LangChain 中有各自的调用方法。
1.  LangChain 提供的 LangServe，可以快速部署 LLM 应用，以 API 的方式对外提供服务，并提供了远程调用的方法。