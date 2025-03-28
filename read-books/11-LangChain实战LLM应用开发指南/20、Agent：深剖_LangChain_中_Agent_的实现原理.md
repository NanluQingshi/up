大家好，欢迎继续学习 LangChain 实战课程。
上节课，我们已经初步感受了 AI Agent 的强大，相比直接使用 LLM，AI Agent 能够实时感知外部环境变化，并做出对应的决策和行动，极大提高了LLM 解决任务的能力和效率。

今天，我将会带大家从头到尾走读一遍 LangChain相关的实现代码，让大家能更好得理解构造和运行 AI Agent 流程中的概念和细节，这对我们构造复杂 Agent 应用，调试 Agent 代码有很大帮助。

在开始之前，请大家先思考下面两个问题：
1. LLM调用返回后，`AgentExecutor`如何判断是需要调用工具还是需要终止执行流程，返回结果给用户？
2. 对于那些不支持函数调用的模型，AI Agent 是如何实现工具的调用？

希望大家能抱着这两个疑问，继续下面的学习。


![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b3b17df5db9c4b2590a6422b70a13417~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1047&h=377&s=47883&e=png&b=ffffff)

# 更通用的ReAct Agent
上节课中使用的`create_openai_tools_agent`是一种比较简单的 AI Agent 类型：直接利用模型的函数调用功能指定要调用的工具函数；`AgentExecutor`也直接根据LLM 返回的消息是否是`tool_calls`判断是需要执行相关工具函数还是返回给用户。但这类 Agent 只能适用支持函数调用功能的模型，具有较大局限性。

实际上，LangChain 提供了一种更通用的ReAct Agent类型：`create_react_agent`，能用于各种模型。

这节课我们将会使用该方法构造一个 ReAct Agent，并以该 AI Agent 作为入口，探讨 LangChain 中 AI Agent 的实现原理。

1. 定义Agent工具函数
```python
# 模拟获取某个城市的天气
def GetWeather(city):
    return 30

from langchain.agents import Tool
# 封装成 Tool
weather_tool = Tool(
        name="search_weather",
        func=GetWeather,
        description="useful for when you need to search for weather",
)

tools = [weather_tool]
```
2. 定义 `Agent`调用链
```python
from langchain_openai import OpenAI
from langchain import hub
from langchain.agents import create_react_agent

llm = OpenAI()
prompt = hub.pull("hwchase17/react")
agent = create_react_agent(llm, tools, prompt)
```
3. 创建`AgentExecutor`执行器
```python
from langchain.agents import AgentExecutor
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
```
通过以上3 步，我们就创建了一个带有能够获取天气的自定义工具的 AI Agent，下面我们尝试让它根据天气制定一份出游计划：
```python
print(agent_executor.invoke({"input": "根据北京的天气情况，制定一个出游计划"}))
```
```shell
> Entering new AgentExecutor chain...
I need to find out the weather in Beijing
Action: search_weather
Action Input: Beijing
30 degrees Celsius with a UV index of 9 means I need to bring strong sunscreen
Final Answer: Based on the weather in Beijing, I should plan for hot and possibly wet weather and bring strong sunscreen
> Finished chain.
{'input': '根据北京的天气情况，制定一个出游计划', 'output': 'Based on the weather in Beijing, I should plan for hot and possibly wet weather and bring strong sunscreen.'}
```
由于我们的提示词过于简单，得到的出游计划也不够完美，但根据上面的执行日志可以看到，这个 AI Agent 确实能按需调用我们的工具函数去辅助处理任务。
下面我们将按构造 AI Agent 的顺序（定义`Tool`、定义`Agent`、定义`AgentExecutor`）来学习 LangChain 中 Agent 的实现原理。

# `Tool`（工具）
工具是AI Agent 在执行任务过程中，能够调用的外部能力。我们可以调用检索器用于特定领域数据的查询，也可以调用自定义函数去执行业务逻辑。为了统一各类外部系统调用方式，LangChain 抽象出一个 Tool 层，任何一个函数都可以通过封装成一个 `Tool` 对象，被 AI Agent 调用。
```python
class BaseTool(RunnableSerializable[Union[str, Dict], Any]):
    ...
    name: str
    ...

class Tool(BaseTool):
    """Tool that takes in function or coroutine directly."""

    description: str = ""
    func: Optional[Callable[..., str]]
    """The function to run when the tool is called."""
```
`Tool`有三个最重要的属性：`name`、`description`和`func`。`name`是工具的名称；`description`用于描述工具的功能和调用方法，这个描述文本会添加到提示词中，LLM 将以此来决定是否调用以及如何调用该工具来推进下一步处理；`func`则是工具实际运行的函数。
以我们上面创建的`weather_tool`为例，在提示词中，将会添加类似以下提示：
```python
prompt = """
...
下面是可用于辅助回答问题的工具：
{"weather_tool": "useful for when you need to search for weather"}
...
"""
```
这样，当 LLM 推理得出需要获取天气时，就会返回以下文本（伪代码）：
```shell
{"use_tool": "weather_tool", "input:"beijing"}
```
`AgentExecutor`维护有一个`tool.name`到`Tool`的映射 map 结构。解析 LLM 上面的响应文本，获取到需要调用的工具名称和调用参数后，根据工具名称在工具 map 中获取到具体的`Tool`实例，然后调用`tool.func(input)`。
以上就是整个 tool 工具的使用流程。通过将工具的描述文本插入到提示词中，让 LLM 在必要的时候返回需要调用的函数及传参，由`AgentExecutor`进行实际的调用。

# `Agent`（LLM调用链）
我们前面说过，AI Agent 其实是多次调用一个 LLM链。这条链在 LangChain 中定义为`Agent`，用于负责决定下一步采取什么行动，通常由提示词，LLM 模型和输出解析器三部分构成。

**不同的 AI Agent 有不同的LLM 链**，我们下面以`create_react_agent`为例，分析其 LLM 链长什么样。

## 提示词模板
首先，我们看下用到的提示词模板：
```shell
# hwchase17/react
Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer

Thought: you should always think about what to do

Action: the action to take, should be one of [{tool_names}]

Action Input: the input to the action

Observation: the result of the action

... (this Thought/Action/Action Input/Observation can repeat N times)

Thought: I now know the final answer

Final Answer: the final answer to the original input question

Begin!

Question: {input}

Thought:{agent_scratchpad}

```
上面的提示词定义了几种前缀(`Thought`/`Action`/`Action Input`/`Observation`/`Final Answer`)。

其中`Thought`是我们提交给 LLM 时追加的，也就是说，**每轮提交给 LLM 的提示词都是以"Thought:"结尾**，这样，LLM会在返回中先写推理思路。以下是两种不同的推理情况：
* 当 LLM 发现当前信息无法解决问题时，会先“阐明”自己的推理思路，并通过`Action`和`Action Input`填入要调用的工具函数及传入的参数，比如：
```shell
I should search for the weather in Beijing to help with planning the trip
Action: weather_tool
Action Input: beijing
```
工具的执行结果会以`Observation`前缀添加到下一轮的提示词中:
```shell
# prompt
...
Observation: 30 # weather_tool的执行结果
...
```

* 如果 LLM根据现有信息已经能得出最终的结果，同样的，也会先输出自己的推理思路，再将最终结果输出到`Final Answer`前缀的文本中，比如：
```shell
30 degrees Celsius is quite hot, I should plan accordingly
Final Answer: the final answer is xxxx
```

我们看看上述例子中的"出游计划"整个过程中与 LLM 交互的提示词的变化：

**第一轮：**
```shell
...
Answer the following questions as best you can. You have access to the following tools:
{"weather_tool": "useful for when you need to search for weather"}
...
Action: the action to take, should be one of [weather_tool]
...
Question: 根据北京的天气情况，制定一个出游计划
Thought:
```
LLM 返回：
```shell
I should search for the weather in Beijing to help with planning the trip
Action: weather_tool
Action Input: beijing
```

**第二轮：**
（`AgentExecutor`调用工具函数获取结果后）
```shell
...
Answer the following questions as best you can. You have access to the following tools:
{"weather_tool": "useful for when you need to search for weather"}
...
Action: the action to take, should be one of [weather_tool]
...
Question: 根据北京的天气情况，制定一个出游计划
Thought:I should search for the weather in Beijing to help with planning the trip
Action: weather_tool
Action Input: beijing
Observation: 30
Thought:
```
LLM返回：
```shell
30 degrees Celsius is quite hot, I should plan accordingly
Final Answer: Based on the weather in Beijing, I should plan for hot and possibly wet weather and bring strong sunscreen
```

## 输出解析器
LLM 输出的文本信息，并不会直接交给`AgentExecutor`处理，而是会先经过输出解析器，根据前缀进行不同的格式化处理。

`create_react_agent`默认使用`ReActSingleInputOutputParser`作为输出解析器，下面是其源码实现：
```python
def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
    # FINAL_ANSWER_ACTION = "Final Answer"
    includes_answer = FINAL_ANSWER_ACTION in text
    # 正则匹配出调用工具名称和参数
    regex = (
            r"Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)"
    )
    action_match = re.search(regex, text, re.DOTALL)
    if action_match:
        action = action_match.group(1).strip()
        action_input = action_match.group(2)
        tool_input = action_input.strip(" ")
        tool_input = tool_input.strip('"')
        return AgentAction(action, tool_input, text)

    elif includes_answer:
        return AgentFinish(
            {"output": text.split(FINAL_ANSWER_ACTION)[-1].strip()}, text
        )
    ...
```
如果 LLM 响应文本中包含`Action`和`Action Input`, 则使用正则匹配出这两前缀后面的内容，并封装成`AgentAction`对象返回。也就是说，这个对象存有要调用的工具名(`tool`)及入参(`tool_input`)。
```python
class AgentAction(Serializable):
    tool: str
    tool_input: Union[str, dict]
    ...
```

如果 LLM 响应文本中包含`Final Answer`，则解析出后面的内容，封装成`AgentFinish`对象，将最终结果以 K-V 方式（key 为`output`）保存在`return_values`中。
```python
class AgentFinish(Serializable):
    return_values: dict
    ...
```

**注意，`Agent`输出解析器解析 LLM 文本转换成`AgentAction`或`AgentFinish`对象不是`ReActSingleInputOutputParser`特有，而是全部`Agent`的输出解析器都会有的操作。通过这一转换层，
`AgentExecutor`只需要处理`AgentAction`和`AgentFinish`即可，而不需要关心具体是哪种类型的`Agent`。**

# `AgentExecutor`（代理执行器）
终于到了整个实现中比较复杂的部分 - `AgentExecutor`，这是 AI Agent 的“运行时”，负责调用LLM 链，执行 LLM 选择的操作（调用工具或最终返回），并将操作结果传回 LLM 链，如此往复。

## `AgentExecutor`的构造
首先，我们先从构造`AgentExecutor`实例看起：
```python
agent_executor = AgentExecutor(agent=agent, tools=tools)
```
其中，传入了两个比较关键的参数 - `agent`和`tools`，分别表示用到的 LLM 链和工具列表。我们再看看`AgentExecutor`定义的这两个参数：
```python
class AgentExecutor(Chain):
    agent: Union[BaseSingleActionAgent, BaseMultiActionAgent]
    tools: Sequence[BaseTool]
```
不知道大家有没有发现问题，我们传入的`agent`是一个 LCEL 链，但`AgentExecutor.agent`需要的却是一个`BaseSingleActionAgent`或`BaseMultiActionAgent`对象。
> `BaseSingleActionAgent`: 每次只能调用一个工具；
> 
> `BaseMultiActionAgent`: 每次可调用多个工具，可以类比《[函数调用：激活 LLM 的超能力](https://juejin.cn/book/7352849785881591823/section/7353235002844741651)》小节中提到的并行函数调用

这是因为借助了`pydantic`库的`root_validator`功能，在构造实例前会先进行字段检查并做出对应的逻辑转换。
```python
class AgentExecutor(Chain):
    ...
    @root_validator(pre=True)
    def validate_runnable_agent(cls, values: Dict) -> Dict:
        agent = values["agent"]
        if isinstance(agent, Runnable):
            ...
            values["agent"] = RunnableAgent(
                    runnable=agent, ...
            )
        return values
```
> 为了精简代码，省去了`BaseMultiActionAgent`的分支逻辑。

在`AgentExecutor`内部，会自动将传入的 LCEL 链转换成`RunnableAgent`，这属于`BaseSingleActionAgent`的一种。
```python
class RunnableAgent(BaseSingleActionAgent):
    runnable: Runnable[dict, Union[AgentAction, AgentFinish]]
    ...
    def plan(
        self,
        intermediate_steps: List[Tuple[AgentAction, str]],
        callbacks: Callbacks = None,
        **kwargs: Any,
    ) -> Union[AgentAction, AgentFinish]:
        inputs = {**kwargs, **{"intermediate_steps": intermediate_steps}}
        ...
        final_output = self.runnable.invoke(inputs, ...)
```
`AgentExecutor`最终是通过上面的 `plan`方法调用前面构造的 LCEL 链。

## `AgentExecutor`的执行
了解完`AgentExecutor`的一些构造细节，我们再来看看`AgentExecutor`是如何与其他组件进行交互执行的。

首先，我们需要找到执行入口函数。我们是通过`invoke`调用执行的，`AgentExecutor`并没有自己实现`invoke`，而是直接使用父类的。`AgentExecutor`继承自`Chain`，`Chain.invoke`会最终调用`self._call`。
```python
class Chain(RunnableSerializable[Dict[str, Any], Dict[str, Any]], ABC):
    ...
    def invoke(
        self,
        input: Dict[str, Any],
        ...
    ) -> Dict[str, Any]:
        ...
        self._call(inputs)
```
所以，`AgentExecutor`的入口函数是`_call`。下面是`AgentExecutor._call`的实现代码(已做精简处理)：
```python
class AgentExecutor(Chain):
    ...
    def _call(
        self,
        inputs: Dict[str, str],
        ...
    ) -> Dict[str, Any]:
        name_to_tool_map = {tool.name: tool for tool in self.tools}
        intermediate_steps: List[Tuple[AgentAction, str]] = []
        iterations = 0
        time_elapsed = 0.0
        start_time = time.time()
        # _should_continue判断能否继续
        while self._should_continue(iterations, time_elapsed):
            next_step_output = self._take_next_step(
                name_to_tool_map,
                ...,
                inputs,
                intermediate_steps,
                ...
            )
         
            if isinstance(next_step_output, AgentFinish):
                return self._return(
                    next_step_output, intermediate_steps, ...
                )
            ...
            intermediate_steps.extend(next_step_output)
            iterations += 1
            time_elapsed = time.time() - start_time
            ...
        return self._return(output, intermediate_steps, ...)
```

对于一次任务处理，AI Agent 并不会无限制处理下去，会有一个最大调用次数(`max_iterations`,默认 15)和最大执行时间(`max_execution_time`，默认 None，即无限制)的限制，并通过`_should_continue`函数进行控制，如果超出次数，就直接退出调用循环。下面是`_should_continue`的实现逻辑：
```python
class AgentExecutor(Chain):
    ...
    def _should_continue(self, iterations: int, time_elapsed: float) -> bool:
        if self.max_iterations is not None and iterations >= self.max_iterations:
            return False
        if (
            self.max_execution_time is not None
            and time_elapsed >= self.max_execution_time
        ):
            return False

        return True
```

每轮循环都会调用`_take_next_step`，我们看看它做了什么(为了方便理解，在这里换了写法)
```python
class AgentExecutor(Chain):
    ...
    def _take_next_step(
        self,
        ...
    ) -> Union[AgentFinish, List[Tuple[AgentAction, str]]]:
        next_steps = []
        for a in self._iter_next_step(
            name_to_tool_map,
            ...,
            inputs,
            intermediate_steps,
            ...
        ):
            next_steps.append(a)
        
        return self._consume_next_step(next_steps)
```
其中，`_iter_next_step`是单轮任务处理的关键函数。
```python
class AgentExecutor(Chain):
    ...
    def _iter_next_step(
        self,
        name_to_tool_map: Dict[str, BaseTool],
        ...,
        inputs: Dict[str, str],
        intermediate_steps: List[Tuple[AgentAction, str]],
        ...
    ) -> Iterator[Union[AgentFinish, AgentAction, AgentStep]]:
        ...
        # 调用 LLM 链
        output = self.agent.plan(
                intermediate_steps,
                **inputs,
            )
        ...
        # 如果是 AgentFinish，直接返回
        if isinstance(output, AgentFinish):
            yield output
            return
        
        actions: List[AgentAction]
        if isinstance(output, AgentAction):
            actions = [output]
        else:
            actions = output
        ...
        # 遍历全部的AgentAction，挨个调用对应工具函数
        for agent_action in actions:
            yield self._perform_agent_action(
                name_to_tool_map, ..., agent_action, ...
            )
```
> 函数涉及到 python 中 yield 的用法，不了解的同学建议先看下[这篇文章](https://www.runoob.com/w3cnote/python-yield-used-analysis.html)。

首先，通过`self.agent.plan`对LLM 链发起调用，上面 #`Agent` LLM调用链# 小节中提到，输出解析器会返回`AgentFinish`或`AgentAction`对象（`MultiActionAgent`可能会返回`AgentAction`数组）。

如果`self.agent.plan`返回了`AgentFinish`，会直接返回。

如果`self.agent.plan`返回的是`AgentAction`或`AgentAction`数组，`_iter_next_step`会遍历每个`AgentAction`, 通过`_perform_agent_action`调用每一个工具函数。

下面是`_perform_agent_action`的代码实现：
```python
class AgentExecutor(Chain):
    ...
    def _perform_agent_action(
        self,
        name_to_tool_map: Dict[str, BaseTool],
        ...,
        agent_action: AgentAction,
        ...
    ) -> AgentStep:
        ...
        if agent_action.tool in name_to_tool_map:
            tool = name_to_tool_map[agent_action.tool]
            ...
            observation = tool.run(
                agent_action.tool_input,
                ...
            )
        ...
        return AgentStep(action=agent_action, observation=observation)
```
先找到`AgentAction.tool`对应的 `Tool`实例，调用`Tool.run`，该方法最终会调用到`Tool.func`，也就是我们封装 `Tool` 对象时传入的业务函数。

完成工具函数的调用后，`_perform_agent_action`会将结果封装到一个新的结构体`AgentStep`中，该类有`action`和`observation`两个关键属性，分别存放 LLM 返回的`AgentAction`和工具函数执行结果。
```python
class AgentStep(Serializable):
    action: AgentAction
    """The AgentAction that was executed."""
    observation: Any
    """The result of the AgentAction."""
    ...
```

我们再将眼光移回`_iter_next_step`, 调用`_perform_agent_action`后，会得到一个`AgentStep`对象，保存有工具函数执行结果。

以上就是`_iter_next_step`的主要处理逻辑。

我们再对`_take_next_step`中的`_iter_next_step`循环调用做个小结：
1. 当`_iter_next_step`中`self.agent.plan`返回`AgentFinish`时，会直接返回该`AgentFinish`对象，并且结束对`_iter_next_step`的循环调用。也就是说，这种情况下`_take_next_step.next_steps` = `[AgentFinish]`。
2. 当`_iter_next_step`中`self.agent.plan`返回`AgentAction`或`AgentAction`数组时，会遍历调用`_perform_agent_action`，得到每个工具函数的结果，并封装成`AgentStep`，也就是说，这个时候，`_take_next_step.next_steps` = `[AgentStep, AgentStep,...]`。

得到`next_steps`后，再将数组传入`_consume_next_step`，该方法主要对数据进行进一步的格式化：
```python
class AgentExecutor(Chain):
    ...
    def _consume_next_step(
        self, values: NextStepOutput
    ) -> Union[AgentFinish, List[Tuple[AgentAction, str]]]:
        if isinstance(values[-1], AgentFinish):
            assert len(values) == 1
            return values[-1]
        else:
            return [
                (a.action, a.observation) for a in values if isinstance(a, AgentStep)
            ]
```
至此，`_take_next_step`调用就算完成了。

我们再将眼光往上移到`_call`上，一次`_take_next_step`调用后，其返回值`next_step_output`有两种可能：
1. `AgentFinish`: 表示 LLM 返回了最终结果，这个时候直接调用`_return`返回用户结果。
2. `[(AgentAction, <工具函数执行结果>),...]`: 表示 LLM 返回需要调用工具，并已经完成对相关工具函数的调用。针对这种情况，会将`next_step_output`添加到`intermediate_steps`中，在下轮调用LLM 时添加到提示词中。

下面再给出整个 AgentExecutor 的调用流程图，帮助大家理解：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4cdd95978c124973b91929e502b09829~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1724&h=812&s=106968&e=png&b=fdfbfb)

今天内容到这就算结束了，相信大家现在已经能回答开头提的那两个问题了：

---

Q：LLM调用返回后，`AgentExecutor`如何判断是需要调用工具还是需要终止执行流程，返回结果给用户？

A：`AgentExecutor`根据LCEL 链的返回数据类型，如果返回`AgentFinish`，就表示已经获取到最终答案了；如果返回`AgentAction`, 则表示需要调用工具函数。

---

Q：对于那些不支持函数调用的模型，AI Agent 是如何实现工具的调用？

A：在提示词中添加工具的描述及传参要求（`Tool.description`），并制定特定符号，配合输出解析器解析获取工具名称和工具参数，由`AgentExecutor`进行工具函数的调用。

---
# 总结
1. 相比`create_openai_tools_agent`, `create_react_agent`是一种更通用的 ReAct Agent,对使用的LLM 无要求。
2. 工具是 AI Agent 在执行任务过程中，能够调用的外部能力，其可以是任意业务函数，为了统一各类外部系统调用方式，LangChain 抽象出一个 `Tool` 层，任何函数都可以通过封装成一个 `Tool` 对象，被 AI Agent 调用。
3. LangChain中的Agent 应用，抽象出一个 `Agent`的概念，表示 AI Agent 在处理任务时用到的 LLM 调用链，负责决定下一步采取什么行动。LangChain支持[多种类型的`Agent`](https://python.langchain.com/docs/modules/agents/agent_types/)，用于创建不同使用场景的 Agent 应用。
4. `AgentExecutor`是 Agent应用 的“运行时”，负责调用LLM 链，执行 LLM 选择的操作（调用工具或最终返回），并将操作结果传回 LLM 链，如此往复。
