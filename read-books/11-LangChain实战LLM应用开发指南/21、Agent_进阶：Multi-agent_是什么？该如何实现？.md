大家好，欢迎继续学习 LangChain 实战课程。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7222966373514025b5dfd8a0158fb33b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1840&h=634&s=96455&e=png&b=ffffff)
# 什么是`Multi-Agent`
今天，我们将学习 Agent 的进阶用法 -- `Multi-Agent`（多代理）。前面我们学习的Agent 应用都属于单代理模式，即一个Agent 应用由一个固定的提示词模板、LLM 模型和工具列表组成。而多代理系统，由多个具有不同功能的Agent组成，这些Agent互相协作，共同解决更复杂的问题。

与单个大 Agent 相比，按职责/功能划分多个子Agent，再由这些 Agent 构造的多代理系统有以下优势：
1. 每个 Agent 需要选择的工具较少，更不容易出错。
2. 每个 Agent 都有单独的提示词和LLM 模型，可以针对各自功能优化提示词、选用不同的 LLM，甚至单独微调 LLM。每个子 Agent 能更好得完成各自的任务。
3. 每个模块不会互相影响，我们可以单独评估和改进子 Agent，而不会对应用整体造成破坏。

这可以类比我们人类社会的工作模式，我们不会让一个人负责整个生产的全部环节，更多的是流水线工作，每个人负责其中一个环节，这样的工作效率更快，替代性也更强，我们可以不断优化各个环节，提高整体效率。

已经多篇论文/研究([论文 1](https://arxiv.org/abs/2402.01680)、[论文 2](https://arxiv.org/pdf/2308.00352))表明，Multi-Agent能够有效减少 LLM 幻觉问题，提高处理任务的准确性和效率。

`Multi-Agent`系统需要协调多个Agent，可能会出现某个 Agent循环调用的情况。比如，一个 Agent处理后，根据某种策略，将结果作为输入传给另外一个 Agent，由于某种原因，后续的 Agent 处理结果又会作为输入传给之前执行过的 Agent 再次处理。

这种复杂的子模块调用关系，很适合用图数据结构来描述系统，每个 Agent 对应一个节点，节点之间的边代表 Agent 之间的交互。
![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/da58b1e1281a4e15b1f87ea0d0d1ba10~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1422&h=730&s=59453&e=png&b=ffffff)

LangChain在 0.1版本中引入了LangGraph，它可以看成 LCEL 的一种扩展，单纯的 LCEL 调用链其实是一种有向非循环图 (DAG) ，每个模块的执行顺序是预先设计好的，并且无法循环调用，而LangGraph弥补了这一缺陷，可以在执行的过程中循环调用之前执行过的模块，这允许我们构造出更复杂的LLM 系统。

今天，我们将先学习 LangGraph 的基本用法，然后介绍 2 种不同的 `Multi-Agent`架构，并演示如何使用 LangGraph 实现它们。

# LangGraph快速入门
首先，我们需要先安装 LangGraph 库。
```shell
pip install langgraph
```

LangGraph 有三个比较重要的概念：节点、边和节点之间的数据传递（LangGraph称为状态机）。 

使用 LangGraph 构造应用，我们需要先定义状态机，即节点之间传输消息的数据结构。再定义应用的各个节点以及节点之间的边，最后，指定一个开始节点，作为执行入口。

## 定义状态机
状态机是指节点之间传输的数据结构，将作为节点的输入和输出。
状态机一般定义为一个继承自`TypedDict`的类型，`TypedDict`可以让我们定义的类有字典的属性，比如：
```python
from typing import TypedDict
# 定义一个TypedDict，指定键和它们的类型 
class Point2D(TypedDict): 
	x: int y: int 
# 使用TypedDict 
point = {'x': 1, 'y': 2}
```

我们可以在状态机中定义多个字段，这些字段将会在节点之间传递，在节点执行结果往下继续传递前，会先对状态机的每个字段进行更新。比如我们定义了下面状态机：
```python
class AgentState(TypedDict):
	current_result: str
```
传递过程如下：
1. 节点接收内容：`AgentState(current_result="")`
2. 节点执行完后，输出内容`AgentState(current_result="hello")`。
3. 在数据真正往下传递时，会先对`AgentState`中的每个字段进行更新，由于`AgentState`只有一个字段`current_result`，所以会执行一次`update(old_current_result, new_current_result)`。
默认情况下，字段的值会更新为最新值，也就是说，`current_result`会被更新为`hello`，即下一节点收到的内容为`AgentState(current_result="hello")`。

我们可以自定义更新的逻辑。比较常见的是合并每个节点的结果，然后往下传递，为了实现这一效果，我们可以利用`Annotated`为字段定义更新行为。如下所示：
```python
from typing import Annotated,Sequence,TypedDict,operator
from langchain_core.messages import BaseMessage
class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], operator.add]
```

此外，LangChain 还为消息的合并设计了`add_messages`, 相比`operator.add`, `add_messages`能够对消息去重，这在某些循环调用的场景下可能会有用。
```python
from langgraph.graph.message import add_messages
from typing import Annotated,Sequence,TypedDict
from langchain_core.messages import BaseMessage
class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], add_messages]
```

定义了状态机后，我们便可以初始化工作流实例，开始图的构造：
```python
from langgraph.graph import StateGraph
workflow = StateGraph(AgentState)
```

## 定义节点和边
在 LangGraph 中，节点可以是一个AI Agent、LCEL 调用链，也可以是任何 python 函数，只要它能接收状态机格式数据，返回状态机格式数据即可。比如我们定义了如下状态机：
```python
class AgentState(TypedDict):
	current_result: str
```
可以使用 LangChain 提供的`add_node`将以下 python 函数定义为节点：
```python
def AddHello(state):
    return {"current_result": "hello, " + state["current_result"]}
    
def AddGoodBye(state):
    return {"current_result": state["current_result"] + ", now good bye!"}

workflow.add_node("hello_node", AddHello)
workflow.add_node("goodbye_node", AddGoodBye)
```
这样，我们就为图系统添加了一个名为`hello_node`和`goodbye_node`的节点。

定义节点后，我们需要为这些节点设计边，将节点之间关联起来。边分为`无条件边`和`有条件边`:

**`无条件边`**

节点的执行路径是固定的，一个节点执行后，下一个执行的节点是确定的。可以通过`add_edge`创建`无条件边`：
```python
workflow.add_edge("hello_node", "goodbye_node")
```
上面我们创建了从节点`hello_node`到`goodbye_node`的节点。

**`有条件边`**

与`无条件边`不同，一个节点可以与多个节点创建`有条件边`, 我们可以根据自定义逻辑判断下一个要执行的节点，`有条件边`通过`add_conditional_edges`方法创建：
```python
from langgraph.graph import END
def router(state):
    if "no run goodbye_node" in state["current_result"]:
        return END
    else:
        return "goodbye_node"
        
workflow.add_conditional_edges("hello_node", router)
```
现在，执行完`hello_node`节点后，会按情况判断是否要执行`goodbye_node`节点。**其中`END`是LangChain 定义的结束节点，需要注意的是，图中每条执行链路的终点都必须是 `END` 节点。**

我们还需要为系统指定一个开始节点，作为执行的入口：
```python
workflow.set_entry_point("hello_node")
```
上面，我们将`hello_node`设置为系统执行的入口。

与LangChain 的其他组件不同，LangGraph真正运行前，我们还需要先进行编译：
```python
graph = workflow.compile()
```

下面再贴出完整的示例代码：
```python
from typing import TypedDict
class AgentState(TypedDict):
	current_result: str
 
def AddHello(state):
    return {"current_result": "hello, " + state["current_result"]}

def AddGoodBye(state):
    return {"current_result": state["current_result"] + ",  now good bye!"}

from langgraph.graph import StateGraph, END
workflow = StateGraph(AgentState)

workflow.add_node("hello_node", AddHello)
workflow.add_node("goodbye_node", AddGoodBye)

def router(state):
    if "no run goodbye_node" in state["current_result"]:
        return END
    else:
        return "goodbye_node"

workflow.add_conditional_edges("hello_node", router)
workflow.add_edge("goodbye_node", END)
workflow.set_entry_point("hello_node")
graph = workflow.compile()
```
我们构造的图结构如下：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/daa6fabf39df49c382102033fc8db95a~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=523&h=521&s=28108&e=png&b=ffffff" alt="image.png"  /></p>

编译后，我们可以通过`invoke`对系统进行调用：
```python
print(graph.invoke({"current_result": "test"}))
# output
# {'current_result': 'hello, test,  now good bye!'}
```

# `Multi-Agent`架构设计
现在，我们已经掌握了LangGraph这个武器的基础用法，接下来我们开始学习如何使用LangGraph构造不同的`Multi-Agent`系统。
## 简单的双 Agent 设计
我们先来看一个最简单的双 Agent 系统，它由两个工作节点组成，节点之间来回调用，不断优化输出，直到达到目标效果。

以程序开发场景为例，我们设计两个 Agent，一个`Coder Agent` 专门进行代码的开发，另外一个 `Reviewer Agent` 对生成的代码进行 review，并给出修改建议，再由`Coder Agent`根据建议对代码进行优化，如此反复，直到`Reviewer Agent`觉得代码没问题为止。这能有效提高 LLM 处理编程问题的准确率。整体系统流程图如下：

<p align=center><img src="https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/825c6501bacb4587867992757639ced6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1308&h=1034&s=139128&e=png&b=ffffff" alt="image.png"  /></p>

* **定义状态机结构**

状态机只需要一个`messages`字段，用于保留之前节点输出，形成短期记忆，让节点执行时有更多的细节。我们可以直接使用LangChain提供的`add_messages`来更新`messages`字段。
```python
from typing import TypedDict, Annotated, Sequence
from langgraph.graph.message import add_messages

# 定义状态机结构
class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], add_messages]

# 创建StateGraph实例
workflow = StateGraph(AgentState)
```

* **定义节点**


```python
# 定义code_node节点
def code_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding. Given the following user request, make a code. Or optimize the code according to the review suggestions. just respond with the final code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}

# 添加code_node节点
workflow.add_node("code_node", code_node)

# 定义review_node节点
def review_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding review. Given the following code. Make some review suggestions but DON'T optimize the code. if the code is good enough, just respond  the code and start with `FINAL CODE:`."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}

# 添加review_node节点
workflow.add_node("review_node", review_node)
```

我们定义了`code_node`和`review_node`两个节点，这两个节点的输入输出都是状态机`AgentState`。

由于在我们的例子中，每个节点执行的功能比较简单，所以我们构造的节点是两个 LCEL 链。遇到功能复杂的可以构造Agent 节点。

根据每个节点中的提示词模板可以看出，`code_node`主要进行代码开发和优化；`review_node`对输入的代码进行 review。

* **定义节点边**

对于`code_node`，每次生成代码后，都需要给`review_node`进行 review，所以需要创建一条从`code_node`指向`review_node`的无条件边。
```python
workflow.add_edge("code_node", "review_node")
```

`review_node`执行后，需要判断是否有进一步的优化建议，如果有，需要跳到`code_node`执行；如果没有，则跳到`END`节点，结束调用。

仔细观察`review_node`的提示词模板，当代码不需要优化时，LLM 的回复中会带有`FINAL CODE`字符串，所以我们可以根据`review_node`的输出中是否带有这个字符串进行路由。

```python
def review_to_code_router(state: AgentState):
    if "FINAL CODE" in state["messages"][-1].content:
        return END
    else:
        return "code_node"

workflow.add_conditional_edges("review_node", review_to_code_router)
```
最后，我们再指定`code_node`作为执行入口，并编译`workflow`，即可进行调用。
```python
# 定义入口节点
workflow.set_entry_point("code_node")
# 编译
graph = workflow.compile()
```

完整代码如下：
```python
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage,HumanMessage
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI

# 定义状态机结构
class AgentState(TypedDict):
	messages: Annotated[Sequence[BaseMessage], add_messages]

workflow = StateGraph(AgentState)

# 定义code_node节点
def code_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding. Given the following user request, make a code. Or optimize the code according to the review suggestions. just respond with the final code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}
# 添加code_node节点
workflow.add_node("code_node", code_node)

# 定义review_node节点
def review_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding review. Given the following code. Make some review suggestions but DON'T optimize the code. if the code is good enough, just respond  the code and start with `FINAL CODE:`."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}

# 添加review_node节点
workflow.add_node("review_node", review_node)

# code_node 无条件到 review_node
workflow.add_edge("code_node", "review_node")

# review_node 需要判断是否有 FINAL CODE 关键字，如果有则结束，否则回到 code_node继续执行
def review_to_code_router(state: AgentState):
    if "FINAL CODE" in state["messages"][-1].content:
        return END
    else:
        return "code_node"

workflow.add_conditional_edges("review_node", review_to_code_router)

# 定义入口节点
workflow.set_entry_point("code_node")
# 编译
graph = workflow.compile()
```

我们丢一道困难级别的 leetcode 算法题试试效果：
```python
result = graph.invoke({"messages": [HumanMessage("给定两个大小分别为 m 和 n 的正序（从小到大）数组 nums1 和 nums2。请你找出并返回这两个正序数组的 中位数 。")]})
for message in result["messages"]:
    print(message.content)
    print("--------")
```
输出：
```shell
code_node: Sure, here's a Python code to find the median of two sorted arrays:

```python
def findMedianSortedArrays(nums1, nums2):
    nums = sorted(nums1 + nums2)
    n = len(nums)
    if n % 2 == 0:
        return (nums[n // 2 - 1] + nums[n // 2]) / 2
    else:
        return nums[n // 2]
\```

This code first merges the two arrays `nums1` and `nums2` into a single sorted array `nums`, and then calculates the median based on the length of `nums`.


review_node: - The given code works correctly in finding the median of two sorted arrays.
- However, it's not efficient, as it sorts the merged array unnecessarily.
- Instead of sorting the entire merged array, you can find the median directly without merging the arrays. This can be done in O(log(min(m,n))) time complexity using the binary search approach.
...

code_node: Here's the optimized Python code to find the median of two sorted arrays using the binary search approach and handling edge cases:

```python
def findMedianSortedArrays(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1

    m, n = len(nums1), len(nums2)
    imin, imax = 0, m
    half_len = (m + n + 1) // 2

    while imin <= imax:
        i = (imin + imax) // 2
        j = half_len - i

        if i < m and nums2[j-1] > nums1[i]:
            imin = i + 1
        elif i > 0 and nums1[i-1] > nums2[j]:
            imax = i - 1
        else:
            if i == 0: max_of_left = nums2[j-1]
            elif j == 0: max_of_left = nums1[i-1]
            else: max_of_left = max(nums1[i-1], nums2[j-1])

            if (m + n) % 2 == 1:
                return max_of_left

            if i == m: min_of_right = nums2[j]
            elif j == n: min_of_right = nums1[i]
            else: min_of_right = min(nums1[i], nums2[j])

            return (max_of_left + min_of_right) / 2.0
\```

This code efficiently finds the median of two sorted arrays using the binary search approach and handles edge cases for empty arrays or arrays with only one element.

review_node: ```python
FINAL CODE:
...
```
可以看到，`review_node`对`code_node`第一次执行的代码提出了一些优化建议，`code_node`也很听“劝地”进行了相关修改。

## `Agent Supervisor`架构
上面的架构简单，直接：每次节点执行后，就跳到另外一个节点执行，或直接退出。但当系统中的节点超过 2 个，这个模式就无法很好对节点进行编排了。

这个时候，我们可以采用一种集中路由的架构，也称为`Agent Supervisor`架构。

在这个模式中，除了业务节点，我们还会定义一个`supervisor` 节点，专门用于路由：当业务节点执行后，都会先回到`supervisor`，由该节点统一调度，决定下一个要执行的节点。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5b21491115f543d9a852293ad26109d1~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1320&h=750&s=62305&e=png&b=ffffff" alt="image.png"  /></p>

下面，我们看看如何使用`Agent Supervisor`架构模式重构上面的例子。


* **定义状态机结构**

除了`messages`字段，我们额外定义一个`next`字段，用于保存下一个要执行的节点。
```python
# 定义状态机结构
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    next: str
# 创建StateGraph实例
workflow = StateGraph(AgentState)
```

* **定义节点**
1. 定义`code_node`和`review_node`节点。
```python
# 定义code_node节点
def code_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding. CODE for the following user request. Or optimize the code according to the review suggestions. just respond with the code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}
# 添加code_node节点
workflow.add_node("code_node", code_node)

# 定义review_node节点
def review_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for giving suggestions for the given code. the suggesstions should not include any code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}

# 添加review_node节点
workflow.add_node("review_node", review_node)
```
这两个节点与之前的定义一致，只是提示词模板有些变化。在`review_node`中，当没有任何优化建议时，不再要求返回"FINAL CODE"字符串，因为我们现在是直接利用`supervisor`节点来路由。

另外，我们还特意强调了`review_node`节点只要给出优化建议，不要自己去优化代码。因为实践发现，有时候`review_node`会直接给出优化后的代码，职责不清。

2. 定义`supervisor`节点。
```python
def supervisor_node(state: AgentState) -> AgentState:
    function_def = {
        "name": "route",
        "description": "Select the next role.",
        "parameters": {
            "title": "routeSchema",
            "type": "object",
            "properties": {
                "next": {
                    "title": "Next",
                    "anyOf": [
                        {"enum": ["code_node", "review_node", END]},
                    ],
                }
            },
            "required": ["next"],
        },
    }
    worker_nodes = ["code_node", "review_node"]
    worker_descs = {
        "code_node": "a helpful AI assistant for coding",
        "review_node": "a helpful AI assistant for giving suggestions for the given code. the suggesstions will not include any code",
    }
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system", 
                "You are a supervisor tasked with managing a conversation between the"
                " following workers:  {worker_descs}. "
                "Given the following user request,"
                " respond with the worker to act next. Each worker will perform a"
                " task and respond with their results and status. When finished,"
                " respond with '{end_node}'."
            ),
            MessagesPlaceholder(variable_name="messages"),
            (
                "system",
                "Given the conversation above, who should act next?"
                " Or should we FINISH? Select one of: {worker_nodes},{end_node}",
            ),
        ]
    ).partial(end_node=END, worker_nodes=", ".join(worker_nodes), worker_descs=json.dumps(worker_descs))
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    supervisor_chain = (
        prompt
        | llm.bind_functions(functions=[function_def], function_call="route")
        | JsonOutputFunctionsParser()
    )
    return supervisor_chain

workflow.add_node("supervisor_node", supervisor_node)
```
`supervisor`节点会根据过往的消息列表和提示词模板中各节点的描述信息(`worker_descs`)，选择下一个要执行的节点，`supervisor`可选择的节点有`code_node`,`review_node`和`END`。这里有个小技巧：**利用函数调用来简化模型输出解析。**

* **定义节点边**
对于业务节点`code_node`和`review_node`，每次执行完后都需要回到`supervisor`节点，所以需要创建一条从`code_node`和`review_node`指向`supervisor`的无条件边。
```python
workflow.add_edge("code_node", "supervisor_node")
workflow.add_edge("review_node", "supervisor_node")
```

`supervisor`则需要有条件地指向`code_node`、`review_node`和`END`节点。
```python
def supervisor_router(state: AgentState) -> str:
    if state["next"] == "code_node":
        return "code_node"
    elif state["next"] == "review_node":
        return "review_node"
    else:
        return END
workflow.add_conditional_edges("supervisor_node", supervisor_router)
```
`supervisor`节点解析 LLM 返回后，会输出类似`{"next": "code_node"}`的结果，这个将作为`supervisor_router`的输入，根据`next`字段的值，决定下一个要执行的节点。

最后，再指定`supervisor_node`为执行入口，并编译`workflow`。
```python
workflow.set_entry_point("supervisor_node")
graph = workflow.compile()
```

完整代码如下：
```python
import json
from typing import TypedDict, Annotated, Sequence
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain.output_parsers.openai_functions import JsonOutputFunctionsParser
# 定义状态机结构
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    next: str

workflow = StateGraph(AgentState)

# 定义code_node节点
def code_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for coding. CODE for the following user request. Or optimize the code according to the review suggestions. just respond with the code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}
# 添加code_node节点
workflow.add_node("code_node", code_node)

# 定义review_node节点
def review_node(state: AgentState) -> AgentState:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", 
             "You are a helpful AI assistant for giving suggestions for the given code. the suggesstions should not include any code."),
            MessagesPlaceholder(variable_name="messages")
        ]
    )
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    code_chain = prompt | llm
    code_ret = code_chain.invoke({"messages": state["messages"]})
    return {"messages": [HumanMessage(code_ret.content)]}

# 添加review_node节点
workflow.add_node("review_node", review_node)


# 定义supervisor节点
def supervisor_node(state: AgentState) -> AgentState:
    worker_nodes = ["code_node", "review_node"]
    function_def = {
        "name": "route",
        "description": "Select the next role.",
        "parameters": {
            "title": "routeSchema",
            "type": "object",
            "properties": {
                "next": {
                    "title": "Next",
                    "anyOf": [
                        {"enum": ["code_node", "review_node", END]},
                    ],
                }
            },
            "required": ["next"],
        },
    }
    worker_descs = {
        "code_node": "a helpful AI assistant for coding",
        "review_node": "a helpful AI assistant for giving suggestions for the given code. the suggesstions will not include any code",
    }
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system", 
                "You are a supervisor tasked with managing a conversation between the"
                " following workers:  {worker_descs}. "
                "Given the following user request,"
                " respond with the worker to act next. Each worker will perform a"
                " task and respond with their results and status. When finished,"
                " respond with '{end_node}'."
            ),
            MessagesPlaceholder(variable_name="messages"),
            (
                "system",
                "Given the conversation above, who should act next?"
                " Or should we FINISH? Select one of: {worker_nodes},{end_node}",
            ),
        ]
    ).partial(end_node=END, worker_nodes=", ".join(worker_nodes), worker_descs=json.dumps(worker_descs))
    llm = ChatOpenAI(model="gpt-3.5-turbo-1106")
    supervisor_chain = (
        prompt
        | llm.bind_functions(functions=[function_def], function_call="route")
        | JsonOutputFunctionsParser()
    )
    return supervisor_chain

workflow.add_node("supervisor_node", supervisor_node)
# 编排各节点的边
# 业务节点执行完后都会回到supervisor节点
workflow.add_edge("code_node", "supervisor_node")
workflow.add_edge("review_node", "supervisor_node")

# supervisor执行后，会选出下一个要执行的节点
def supervisor_router(state: AgentState) -> str:
    if state["next"] == "code_node":
        return "code_node"
    elif state["next"] == "review_node":
        return "review_node"
    else:
        return END

workflow.add_conditional_edges("supervisor_node", supervisor_router)

# 定义入口节点，从 supervisor 节点开始
workflow.set_entry_point("supervisor_node")
graph = workflow.compile()
```

以上个例子中的算法题进行测试：
```python
for s in graph.stream(
    {
        "messages": [
            HumanMessage(content="给定两个大小分别为 m 和 n 的正序（从小到大）数组 nums1 和 nums2。请你找出并返回这两个正序数组的 中位数 。")
        ]
    }
):
    if "__end__" not in s:
        print(s)
```
输出：
```shell
{'supervisor_node': {'next': 'code_node'}}
{'code_node': {'messages': [HumanMessage(content='Sure, you can use th...')]}}
{'supervisor_node': {'next': 'review_node'}}
{'review_node': {'messages': [HumanMessage(content="It seems like the ap...")]}}
{'supervisor_node': {'next': 'code_node'}}
{'code_node': {'messages': [HumanMessage(content="\```python\ndef findMedianSortedArrays(nums1, nums2)...)]}}
{'supervisor_node': {'next': '__end__'}}
```
可以看到，整个流程都由`supervisor`节点调度，`code_node`和`review_node`节点只负责执行具体的任务，并将结果返回给`supervisor`节点。

# 总结
今天，我们主要介绍了`Multi-Agent`（多代理）的概念和应用，以及如何使用LangGraph库来构建和设计复杂的多代理系统。
1. 多代理系统由多个具有不同功能的Agent组成，与单代理系统相比，多个子Agent互相协作能够解决更复杂的问题。
2. LangGraph于LangChain 0.1版本引入的，用于描述复杂的子模块调用关系，允许在执行过程中循环调用之前执行过的模块，构造更复杂的LLM系统。
3. `Multi-Agent`有多种设计模式，我们今天介绍了简单的双Agent系统和采用集中路由的`Agent Supervisor`架构。