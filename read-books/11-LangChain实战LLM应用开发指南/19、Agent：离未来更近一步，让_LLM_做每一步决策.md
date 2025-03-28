
大家好，欢迎继续学习 LangChain 实战课程。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b681bbdede504714af97d4a4fe28db3a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2046&h=706&s=97933&e=png&b=ffffff" alt="image.png"  /></p>


## 什么是 AI Agent

AI Agent 算是 AI 界当前最热门的话题之一，字节海外有 [Coze](https://www.coze.com/)、国内有[扣子](https://www.coze.cn/)，阿里有 AI 助理，而且最近发布了自家的 AI Agent 市场。

那么，什么是 AI Agent？与前面学习的大语言模型相比，AI Agent 又有什么区别和优势呢？我们如何在 LangChain 中构造自己的 AI Agent 呢？

虽然大型语言模型（LLMs）在语言理解和交互式任务中表现出色，但它们的推理和行动能力往往是分开的。

我们先解释下上面说的推理能力和行动能力。

- **推理能力**：指的是 LLM 能够进行逻辑推理解决问题。例如，前面学习的`COT`提示技巧，我们可以简单地在指令中添加 “think step by step”，让 LLM 一步步推理，解决需要多步逻辑思考的问题，这里体现了 LLM 的推理能力。

- **行动能力**：指的是语言模型能够在交互式环境中生成行动或决策，LLM 根据给定的指令，执行相应的动作。比如，在 RAG 系统中，根据用户提出的问题，LLM 从知识库中检索并生成对应的答案，这里主要涉及到模型的行动能力。

在传统的研究中，这两部分一般不会同时被考虑。推理不会随着外部环境改变，而行动专注于如何在给定环境中生成最优的行动序列，而不是依赖于深层次的推理。

下面举一个简单的例子：

我们给 LLM 一份西红柿炒鸡蛋的菜谱，其中有明确的做菜步骤：
> 1. 从冰箱中取出鸡蛋和西红柿。
> 2. 开火烧油。
> 3. 放入鸡蛋和西红柿。
> 4. 放入适量的盐。

LLM 会遵循上面的每个步骤去做菜，但实际情况是，冰箱中可能没有鸡蛋，但是 LLM无法适应这个情况，还是会继续往下执行。

AI Agent 由此被提出，AI Agent 以 LLM 为大脑，结合其推理和行动能力，当用户提出问题时，Agent 能够感知环境、构建记忆、进行规划和决策，甚至能够与其他 Agent 协同合作，共同完成任务。此外，Agent 还能通过调用工具，与外部系统进行交互，进一步增强 Agent 的能力。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0a123f784fc340058af6af0bba493d34~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1530&h=766&s=68603&e=png&b=ffffff" alt="image.png"  /></p>

AI Agent 有多种实现模式，[ReAct](https://arxiv.org/abs/2210.03629) 是其中一种，**LangChain 就是基于 ReAct 实现的 AI Agent**，所以，这节课我们主要介绍 ReAct 设计模式以及在 LangChain 中如何快速创建一个 AI Agent。




## ReAct

`ReAct`第一版论文发表于 2022 年 10 月，当时 ChatGPT 还没面世，该论文提出一种结合了推理（reasoning）和行动（acting）的语言模型应用范式，旨在通过交替生成推理轨迹和特定任务的动作，使得大型语言模型（LLMs）在解决多样化的语言推理和决策任务时能够实现更深层次的协同作用。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/44cf8cd7594042cda0cee04501385ff9~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2074&h=550&s=120858&e=png&b=fefefe" alt="image.png"  /></p>

<p align=center>[图片来源于论文]</p>

`ReAct`引入了观察（`Observation`）环节，在每次执行（`action`）完后，都会先观察（`observation`）当前现状后，再进行下一步的推理（`reason`）。还是上面西红柿炒鸡蛋的例子，我们看看`ReAct`是怎么完成的？

> 1. Thought：需要从冰箱中取出鸡蛋和西红柿
> 2. Action：从冰箱中取出鸡蛋和西红柿
> 3. Observation：冰箱中没有鸡蛋
> 4. Thought：需要去市场买鸡蛋
> 5. Action：去市场买鸡蛋回来
> 6. Observation：鸡蛋买回来了
> 6. Thought：需要开火烧油
> 7. Action：开火烧油
> 8. Observation：开火烧油完成
> 9. Thought：需要放入鸡蛋和西红柿
> 
> ……

ReAct 的原理很简单，对应到具体的实现就是循环调用 LLM，解析 LLM 结果，根据结果生成新的指令，直至达到目标。

仔细对比上面的 AI Agent 四要素（`记忆`、`规划`、`行动`、`工具`），我们离一个真正的 AI Agent 还差了`记忆`和`工具`两个模块。

经过前面两节关于 LangChain 记忆模块的学习，我们可以很容易为 LLM 调用链集成记忆功能。

至于`工具`，可以简单理解为增强版的函数调用，前面我们学的函数调用功能是由模型能力决定的，只有 OpenAI、Gemini 等几个少数大模型支持。

而 LangChain 在实现 AI Agent 的工具时，依靠提示词规范 LLM 响应，并由代码解析响应文本，将函数调用的能力扩展到全部模型，`工具`具体实现细节我们留到下节再讲。

下面，我们再给出 ReAct 实现 AI Agent 的完整流程图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0536670ca7c34d629e1b2b38863e8875~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2480&h=932&s=160245&e=png&b=fffefe" alt="image.png"  /></p>




## 使用 LangChain 构造一个 AI Agent

接下来，我们将详细介绍如何使用 LangChain 构造一个能网上搜索相关问题资料，并将答案自动存储到本地文件中的 AI Agent，并为该 Agent 添加记忆功能，支持多轮对话。

LangChain 中构造一个 Agent 可分为以下三步。

1. 定义工具。增强 LLM 外部交互能力。
2. 编排构造 Agent。将 LLM、prompt、工具各部分组件串联刚起来，构造一个可运行的 Agent。
3. （可选）为 Agent 添加记忆组件。


### 定义工具

分析我们的 Agent 功能，其中 “联网搜索” 和 “写入本地文件” 明显都超出了 LLM 本身的能力范围，所以，我们需要定义网络搜索工具和本地文件读写工具来支持。

#### 网络搜索工具

LangChain 提供了接入多种外部系统的相关接口，我们可以很方便地将外部系统的能力集成到 Agent 中。其中，单网络搜索相关就有 [Bing Search](https://python.langchain.com/docs/integrations/tools/bing_search/)、[Brave Search](https://python.langchain.com/docs/integrations/tools/brave_search/)、[DuckDuckGo Search](https://python.langchain.com/docs/integrations/tools/ddg/)、[Google Search](https://python.langchain.com/docs/integrations/tools/google_search/) 等十几种，而且还在不断增加。

今天，我们选用 [SearchApi](https://python.langchain.com/docs/integrations/tools/searchapi/)，因为它是少数几个不需要科学上网就能访问的。

为了使用 SearchApi 搜索，我们需要先注册一个账户，大家可以点击[这里](https://www.searchapi.io/)进行注册。完成后，SearchApi 赠送了我们 100 次免费搜索，我们需要通过其提供的`API Key`进行调用，如下所示：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/420d70650de542d5a180a98a72bb3d15~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2876&h=1288&s=215618&e=png&b=fafafa" alt="image.png"  /></p>

下面，我们看看具体的调用方法：

```python
os.environ["SEARCHAPI_API_KEY"] = "替换成自己的 api key"
from langchain_community.utilities import SearchApiAPIWrapper

search = SearchApiAPIWrapper()
print(search.run("什么是langchain"))
# output
"""
LangChain is a framework designed to simplify the creation 
of applications using large language models. As a language 
model integration framework, LangChain's use-cases largely 
overlap with those of language models in general, including 
document analysis and summarization, chatbots, and code analysis.
"""
```
由上可见，我们通过调用`SearchApiAPIWrapper.run`方法去网上进行搜索。

接下来，我们需要将其封装成一个 `Tool`工具对象，才能给 Agent 使用。

```python
from langchain.agents import Tool

search_tool = Tool(
        name="search_tool",
        func=search.run,
        description="useful for when you need to ask with search",
)
```

这样，一个网络搜索工具就算完成了。


#### 本地文件读写工具

LangChain 不仅提供了集成各种外部系统的接口，还将一些常用的`Tool` 类打包成不同的工具包（`toolKit`）， 可以开箱即用。其中就有专门用于本地文件管理的工具包`FileManagementToolkit`。

默认情况下，`FileManagementToolkit`工具包提供了对文件增删改查多个工具类。

```python
from langchain_community.agent_toolkits import FileManagementToolkit
tools = FileManagementToolkit(root_dir="/data/").get_tools()
print(tools)
"""
[CopyFileTool(root_dir='/data/'), 
DeleteFileTool(root_dir='/data/'), 
FileSearchTool(root_dir='/data/'), 
MoveFileTool(root_dir='/data/'), 
ReadFileTool(root_dir='/data/'), 
WriteFileTool(root_dir='/data/'), 
ListDirectoryTool(root_dir='/data/')]
"""
```

> `root_dir`用于指定操作文件的工作目录，不指定时表示操作当前目录下的文件。

在我们的 Agent 示例中，只需要用到`FileManagementToolkit`工具包中的`WriteFileTool`来写入文件。

可以在初始化工具包时，传入参数`selected_tools`指定需要用到的工具。

```python
from langchain_community.agent_toolkits import FileManagementToolkit
tools = FileManagementToolkit(selected_tools=["write_file"]).get_tools()
write_file_tool = tools[0]
```

现在尝试使用 `write_file_tool`写入一个文件：

```python
write_file_tool.invoke({"file_path": "example.txt", "text": "LangChain"})
```

执行后，可以在当前目录下（因为在初始化`FileManagementToolkit`时未指定`root_dir`）看到已经创建了`example.txt`文件。

至此，我们已经定义好了 Agent 需要用到的两个工具：`search_tool`和`write_file_tool`。



### 编排构造 AI Agent

在 LangChain 中，将一个完整运行的 AI Agent 分为`Agent`和`AgentExecutor`两部分。

**Agent**

其实就是 AI Agent 运行时的 LLM 调用链，由提示词、LLM 和输出解析器构成。不同类型`Agent`构造 LLM 调用链的方式不同，使用到的提示词和输出解析器也不同。

比如，OpenAI 的模型，原生支持函数调用，使用这类模型的 `Agent`可以通过`bind`的方式去使用工具；而其他不支持函数调用的模型，则需要在提示词中对 LLM 进行引导，让 LLM 能根据具体情况返回需要使用的工具名及调用参数。这两类`Agent`所需要用到的输出解析器也不同。

所以，LangChain 提供了多种创建`Agent`的方法，用于创建不同类型的`Agent`。

在今天的示例中，我们将选用`create_openai_tools_agent`来创建`Agent`，我们先简单看下这个方法的实现：
```python
def create_openai_tools_agent(
    llm: BaseLanguageModel, tools: Sequence[BaseTool], prompt: ChatPromptTemplate
) -> Runnable:
    missing_vars = {"agent_scratchpad"}.difference(prompt.input_variables)
    if missing_vars:
        raise ValueError(f"Prompt missing required variables: {missing_vars}")

    llm_with_tools = llm.bind(tools=[convert_to_openai_tool(tool) for tool in tools])

    agent = (
        RunnablePassthrough.assign(
            agent_scratchpad=lambda x: format_to_openai_tool_messages(
                x["intermediate_steps"]
            )
        )
        | prompt
        | llm_with_tools
        | OpenAIToolsAgentOutputParser()
    )
    return agent
```
可以发现，代码整体逻辑很简单，就是构造一条 LCEL 链。

该方法需要传入`llm`、`tools`和`prompt`三个参数，分别代表使用的模型实例、用到的工具列表和提示词模板，这也是大部分 `Agent`创建方法需要传入的参数。

对于传入的`prompt`，会检查其是否留有`agent_scratchpad`占位符，这个变量是`AgentExecutor`用来传入中间结果的。**LangChain 中所有 AI Agent 的提示词都需要有这个变量。**

接下来，会用`convert_to_openai_tool`方法将每个`Tool`类转换为 OpenAI 的工具对象，并绑定到`llm`上，得到一个新的`llm_with_tools`对象。

最后，会使用`OpenAIToolsAgentOutputParser`作为输出解析器，将模型的输出解析为 LangChain 能够处理的数据结构。

我们在前面环节已经定义好了需要用到的工具，我们现在来创建`create_openai_tools_agent`需要的另外两个参数实例`llm`和`prompt`。

**`llm`**

模型只要是 OpenAI 系即可，在这里我们直接实例化一个 `ChatOpenAI` 模型实例：

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-3.5-turbo-0125", temperature=0)
```

**`prompt`**

LangChain 为每种`Agent`都在 [LangChainHub](https://smith.langchain.com/hub) 上提供了对应的提示词模板，对于`create_openai_tools_agent`，我们可以使用 [hwchase17/openai-tools-agent](https://smith.langchain.com/hub/hwchase17/openai-tools-agent) 这个模板。

```python
from langchain import hub
prompt = hub.pull("hwchase17/openai-tools-agent")
```
我们可以看看这个提示词模板的结构：

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66c10162b40b4b8eb0b16211e4a49bca~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2148&h=996&s=129107&e=png&b=ffffff" alt="image.png"  /></p>

> 看到这个提示词不知道大家是否会有疑问，上面 ReAct 提到的 `Thought`、`Action`和`Observation`怎么在提示词都看不到？
>
>其实，大家再仔细想下，对于支持函数调用的模型来说，ReAct Agent 其实就是自动帮你调用工具函数而已。
>
>当 LLM 发现需要调用工具后，会以`tool_calls`的方式返回，这对应了`Thought`和`Action`。代码解析后，调用对应的工具函数，再将调用结果以`Observation`前缀返回给 LLM。

日常开发过程中，我们会先确定好`Agent`的类型，然后以 LangChain 提供的对应提示词模板为基础，按照自己的实际场景进行定制调整。

现在，我们已经有了`tools`、`llm`和`prompt`，可以调用`create_openai_tools_agent`来创建`Agent`：

```python
agent = create_openai_tools_agent(llm, tools, prompt)
```

**AgentExecutor**

有了`Agent`这个 LLM 调用链，我们还需要有人去调用它，根据模型响应决定能否结束调用返回给用户，如果不能，需要调用 LLM 指定的工具，并将调用结果传回给 LLM，如此往复。`AgentExecutor`就是这个执行者。

下面是`AgentExecutor`执行的伪代码：

```python
next_action = agent.get_action(...)  
while next_action != AgentFinish:  
    observation = run(next_action)  
    next_action = agent.get_action(..., next_action, observation)  
    return next_action
```
虽然上面逻辑看着比较简单，但实际上`AgentExecutor`还需要处理工具参数的转换和调用工具过程中的异常情况。


下面是初始化`AgentExecutor`的使用代码：

```python
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
```


其中，`verbose`参数设置为`True`，可以打印出执行过程中的日志信息。

现在，我们可以调用`agent_executor.invoke`方法来运行该 AI Agent：

```python
agent_executor.invoke({"input": "网上搜索 langchain 相关资料，并将相关内容写入 langchain_info.txt中"})
```


执行日志如下：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7f49bc80cfdb4046885bab30ccee0a0b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2090&h=480&s=127926&e=png&b=181818" alt="image.png"  /></p>

运行完后，我们可以在项目根目录中发现已经新建了一个`langchain_info.txt`文件，里面记录着搜索结果内容。

```shell
# cat langchain_info.txt
LangChain is a framework ... code analysis.
```

我们再测试一个 case，验证我们的 AI Agent 确实能根据实际情况按需调用工具完成任务。

```python
agent_executor.invoke({"input": "计算 1+1的结果，并将结果写入 math.txt 文件"})
```

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/058932468aea4897b16ad4052e40a713~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1380&h=268&s=46804&e=png&b=181818" alt="image.png"  /></p>

可以看到这回 LLM 完成计算后，直接调用`write_file`工具将结果写入`math.txt`文件中。

```shell
# cat math.txt
2
```


### 为 AI Agent 添加记忆功能

最后，我们再为 AI Agent 添加记忆功能，让它能支持多轮对话。

`AgentExecutor`本身是继承自`Chain`，所以可以将其简单当成一个 LCEL 链。
我们可以直接套用[《Memory：让你的 AI 助手记忆不止 7 秒》](https://juejin.cn/book/7352849785881591823/section/7353239470834974746)小节中介绍的使用`RunnableWithMessageHistory`为 LCEL 链添加记忆功能的做法。

```python
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
message_history = ChatMessageHistory()
agent_with_chat_history = RunnableWithMessageHistory(
    agent_executor,
    lambda session_id: message_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)
```


现在，我们已经拥有了一个带记忆功能的完整 AI Agent，我们来试下实际效果：

```python
agent_with_chat_history.invoke({"input": "网上搜索 langchain 相关资料"}, config={"configurable": {"session_id": "test"}})
print(agent_with_chat_history.invoke({"input": "你刚才搜索到的资料是什么"}, config={"configurable": {"session_id": "test"}}))
```

打印结果如下：

```shell
{'input': '你刚才搜索到的资料是什么', 

'chat_history': [
HumanMessage(content='网上搜索 langchain 相关资料'), 
AIMessage(content='I found information about LangChain, which is a framework designed to simplify the creation of applications using large language models. It is used for tasks such as document analysis and summarization, chatbots, and code analysis.')
], 

'output': 'I found that LangChain is a framework designed to simplify the creation of applications using large language models. It is used for tasks such as document analysis and summarization, chatbots, and code analysis.'
}
```

下面，再给出完整的示例代码：

```python
import os
os.environ['OPENAI_API_KEY'] = '替换自己的 api key'
os.environ['OPENAI_API_BASE'] = '替换自己的base url'

from langchain import hub
from langchain.agents import AgentExecutor ,create_openai_tools_agent
from langchain_community.utilities import SearchApiAPIWrapper
from langchain.agents import Tool
from langchain_openai import ChatOpenAI
from langchain import hub
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# 定义FileSystem tool
from langchain_community.agent_toolkits import FileManagementToolkit

tools = FileManagementToolkit(selected_tools=["write_file"]).get_tools()

write_file_tool = tools[0]

# 定义 SearchApi Tool
os.environ["SEARCHAPI_API_KEY"] = "替换自己的 searchApi key"
search = SearchApiAPIWrapper()
search_tool = Tool(
        name="search_tool",
        func=search.run,
        description="useful for when you need to ask with search",
)

tools = [write_file_tool, search_tool]

# 创建 Agent
llm = ChatOpenAI(model="gpt-3.5-turbo-0125", temperature=0)
prompt = hub.pull("hwchase17/openai-tools-agent")
agent = create_openai_tools_agent(llm, tools, prompt)

# 创建 AgentExecutor
agent_executor = AgentExecutor(agent=agent, tools=tools, stream_runnable=False,verbose=True)

# 添加记忆模块
message_history = ChatMessageHistory()
agent_with_chat_history = RunnableWithMessageHistory(
    agent_executor,
    lambda session_id: message_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)
agent_with_chat_history.invoke({"input": "网上搜索 langchain 相关资料, 并将结果写入langchain.txt中"}, config={"configurable": {"session_id": "test"}})
print(agent_with_chat_history.invoke({"input": "你刚才搜索到的资料是什么"}, config={"configurable": {"session_id": "test"}}))
```




## 总结

1. AI Agent 以 LLM 为大脑，结合推理能力和行动能力，能够感知环境、构建记忆、进行规划和决策，极大提高了解决问题的能力和效率。
2. ReAct 是一种实现 AI Agent 的设计模式。通过在 LLM 响应后的观察环节，“反思” LLM 输出内容，并做出下一步的决策。这种模式的核心在于模拟人类的解决问题方式，通过逻辑推理和环境互动来逐步推进任务的完成。
3. 在 LangChain 中创建 AI Agent，可以分为定义`Tool`工具列表、创建 `Agent`对象和创建 `AgentExecutor` 执行器三步。
4. `AgentExecutor`本身是继承自`Chain`，所以可以将其简单当成一个 LCEL 链。我们可以直接使用`RunnableWithMessageHistory`为 AI Agent 添加记忆功能。




