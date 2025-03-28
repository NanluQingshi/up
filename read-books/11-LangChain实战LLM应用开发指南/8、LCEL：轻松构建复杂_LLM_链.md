大家好，欢迎继续学习 LangChain 实战课程。

今天，我们将深入学习 LangChain 中的一个核心模块：**`链`**。与其说是模块，更准确地说是 LangChain 的核心概念，因为这代表了框架的核心设计思路：**连接一切组件，用清晰明了的方式构建复杂的 LLM 应用**。

在 LangChain 中，组件的创建和 LLM 应用的构建在一定程度上是解耦的。截至目前，我们已经学习的组件有提示模板、LLM 模型和输出解析器，这些组件都是构建 LLM 应用的其中一个环节，它们按照预设的顺序串联起来。如果某个环节组件效果不好，比如发现了更适合的 LLM 模型，我们只需要修改使用的模型实例，将之前的实例替换掉即可，应用的其他组件完全不需要修改。

这种将组件串联起来建链的设计思路，使得 LLM 应用的构建变得非常灵活、可控。

LangChain 的建链方式经历过一次升级，从以类的方式（`XXXChain`）更新到使用`LCEL（LangChain Expression Language）`构建 LLM 链。今天，我们将从传统链与 LCEL 建链的对比开始，详细介绍 LCEL 建链的优点和用法，更进一步介绍 LCEL 的实现原理。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d86e9fca41747389828fdc8834550b6~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1882&h=1132&s=181816&e=png&b=ffffff" alt=""  /></p>



## 传统链 VS LCEL 建链

在仔细研究 LCEL 之前，我们先通过一个例子来初步了解 LCEL 是什么，以及与传统链相比，LCEL 又有什么不同。



### 传统复杂 LLM 链的构建

假设我们要创建三个教学问答 LLM 链，一个回答物理问题，一个回答数学问题，另外一个处理通用问题。

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAI

llm = OpenAI(temperature=0)

math_prompt_template = """
You are an expert in math.
Respond to the following question:
Question: {question}
Answer:
"""

physics_prompt_template = """
You are an expert in physics.
Respond to the following question:

Question: {question}
Answer:
"""

other_prompt_template = """
Respond to the following question:
Question: {question}
Answer:
"""

math_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(math_prompt_template))
physics_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(physics_prompt_template))
other_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(other_prompt_template))
```

现在，我们需要根据用户输入的不同问题，选择不同的 LLM 链来回答：输出数学问题，我们就选择`math_chain`回答；输入物理问题，我们就选择`physics_chain`回答；输入其他问题，我们就选择`other_chain`回答。

为了实现这个功能，我们再创建一条 LLM 链，用于识别用户输入的问题类型。

```python
classify_prompt_template = """
Given the user question below, classify it as either being about `Math`, `Physics`, or `Other`.
Do not respond with more than one word.

<question>
{question}
</question>

Classification:
"""
classify_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(classify_prompt_template))
print(classify_chain.invoke({"question":"说一个笑话"}))
# >> Other
print(classify_chain.invoke({"question":"1+1等于多少"}))
# >> Math
print(classify_chain.invoke({"question":"重力加速度是多少"}))
# >> Physics
```

接下来，我们使用`classify_chain`进行路由，将用户输入的问题分类到对应的 LLM 链中。

```python
user_input = "1+1等于多少"
question_type = classify_chain.invoke({"question":user_input})
if question_type == "Math":
    chain = math_chain
elif question_type == "Physics":
    chain = physics_chain
else:
    chain = other_chain
print(chain.invoke({"question":user_input}))
```

加上 `if/else` 分支后，代码就开始变的复杂起来了，目前只有三个分支还好，如果后续环节增加，代码会变得越来越难以维护。我们无法很清晰追踪链之间的连接关系，也就不敢随意修改链的逻辑，因为不知道会影响到后续哪些环节。



### LCEL 构建复杂 LLM 链

现在，我们使用 LCEL 语法来重写上面的 LLM 链。

```python
...
llm = OpenAI(temperature=0)
# 提示模板字符串与上面一致，不再重复
math_prompt_template = """xxxx"""
physics_prompt_template = """xxxx"""
other_prompt_template = """xxxx"""  
classify_prompt_template = """xxxx"""

# 使用LCEL的方式构造4个LLM链
from langchain_core.output_parsers import StrOutputParser

math_chain = PromptTemplate.from_template(math_prompt_template) | llm | StrOutputParser()
physics_chain = PromptTemplate.from_template(physics_prompt_template) | llm | StrOutputParser()
other_chain = PromptTemplate.from_template(other_prompt_template) | llm | StrOutputParser()
classify_chain = PromptTemplate.from_template(classify_prompt_template) | llm| StrOutputParser()

# 定义回答问题的链调用逻辑
from langchain_core.runnables import RunnableBranch
from operator import itemgetter
answer_chain = RunnableBranch(
    (lambda x: "math" in x["topic"].lower(), math_chain),
    (lambda x: "physics" in x["topic"].lower(), physics_chain),
    other_chain
)

# 拼接最终的链
final_chain =  {"topic": classify_chain, "question": itemgetter("question")} | answer_chain
print(final_chain.invoke({"question":user_input}))
```

什么鬼，使用 LCEL 还变复杂了？？

LCEL 的语法，很明显一个特点是变得不像 python 了，**组件和组件之间，甚至链与链之间都使用管道符 "|" 进行连接**。而且，它还引入了新的概念，比如`Runnable`，提高了构建链的学习成本。


但是，这种使用管道符 "|" 连接一切的做法，把数据流向可视化了，我们可以很清楚看到组件/链的下一跳是什么。这种方式的“组合性”更强，使得 LLM 应用的构建变得更加灵活、可控。


当然，如果只是上面这点优点，相比提高的学习门槛，很多人肯定还是宁愿用传统链的方式。

LangChain 为 LCEL 给出的愿景是 “创造任何 LLM 链，从原型到生产，无需更改代码（LCEL was designed from day 1 to support putting prototypes in production, with no code changes, from the simplest “prompt + LLM” chain to the most complex chains）”，所以，承载着 LangChain 这么大 "使命" 的 LCEL，肯定不会那么简单。

  


## 为什么推荐 LCEL 方式建链？

-   **支持流处理**

在某些场景下，流处理能极大提高用户的使用体验。比如在聊天场景下，模型响应的每个字，都能实时反馈给用户，而不需要等到模型全部响应完才一次性返回给用户。使用 LCEL 创建的链，天然地支持流处理。

```python
chain = prompt_template | llm | output_parser
for chunk in chain.stream({"input": "test"}):
    print(chunk, end="", flush=True)
```

  


-   **支持批处理**

LCEL 支持批处理，可以一次性处理多个输入，并返回多个输出。这比我们自己循环调用多次链，效率要高很多。而且，不仅是整个链，LCEL 链上的每个环节也都可以支持批处理。这种需求很常见，比如我们需要同时从外部多个数据源同时获取数据，然后再交由下一环节处理。使用 LCEL，我们可以不再需要额外管理批处理相关的代码逻辑。

```python
chain = prompt_template | model | output_parser
result_list = chain.batch([{"input": "test1", "input": "test2"}])
# >> ["output1", "output2"]
```

  


-   **支持异步**

在使用传统链时，为了实现异步处理，我们需要很多的 async/await 代码来控制执行，这会让代码变得非常复杂。LCEL 为每个同步调用（invoke、stream、batch）都提供了异步版本（ainvoke、astream、abatch），使得异步处理更加方便。

```python
chain = prompt_template | llm | output_parser
chain.ainvoke({"input": "test"})
```

  


-   **支持 fallback 逻辑**

有时候，为了提高 LLM 应用的鲁棒性，我们会备份多个 LLM 链，当主链出现问题时，可以自动切换到备份链。在传统链方式下，我们需要自己通过 try/except 来捕获异常然后切换备份链，LCEL 支持 fallback 逻辑，可以使代码变得更加简洁。

```python
chain = prompt_template | llm1 | output_parser
fallback_chain = prompt_template | llm2 | output_parser
chain.with_fallbacks([fallback_chain])
chain.invoke({"input": "test"})
```


此外，使用 LCEL 的每个组件/链都内置集成了 LangSmith，可以方便地进行组件的调试和测试。总之，LangChain 不断增加 LCEL 的功能，使得 LLM 应用的构建更简洁方便。而且，我们不需要关心链的执行方式，到底是要批量处理还是要异步，只要按照业务逻辑将各个组件连接起来，后续这条链的代码就不需要修改了。**LLM 链越复杂，LCEL 的优势就越明显**。







## LCEL 实现原理

使用一个框架，尤其是 LCEL 这种看似新创建了一种新的调用方式，如果没有理解其实现原理，在实际开发和调试过程中，会有很多摸不着头脑的地方，不知道错哪了，也不知道如何修改。


### 神奇的管道符究竟怎么回事？

探究 LCEL 的原理，第一步肯定要搞清楚这个管道符（"|"）到底是怎么回事。

这其实还是原生的 python 方法。"|" 本质是 python 的按位或运算符，当 python 解释器看到 "|" 时，比如`A|B`，会调用`A.__or__`方法，并传入 B 作为参数。即`A.__or__(B)`。也就是说下面两个表达式是等价的：

```python
A | B
A.__or__(B)
```

所以，我们可以重写`__or__`方法，来实现自定义的管道符处理逻辑。

```python
class Runnable:
    def __init__(self, func):
        self.func = func

    def __or__(self, other):
        def chained_func(*args, **kwargs):
            return other(self.func(*args, **kwargs))
        return Runnable(chained_func)

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)
```

上面我们创建了一个`Runnable`类，它实际上是一个包装器，我们看看它最基本的用法：

```python
def add(x, y):
    return x + y

add_runner = Runnable(add)
print(add_runner(1, 2))  # 3
```

这段代码定义了一个`add`函数，然后包装成`Runnable`对象，实例化`Runnable`对象时，会调用`__init__`，将传入的`add`赋值给`self.func`。

然后，我们调用`add_runner(1, 2)`，实际上是调用`add_runner.__call__`(1, 2)，即最终调用了`add`函数。

现在，我们加大难度，看看两个`Runnable`对象通过管道符连接起来会发生什么。

```python
def add(x, y):
    return x + y

add_runner = Runnable(add)

def double(x):
    return x * 2

double_runner = Runnable(double)

result_runner = add_runner | double_runner
print(result_runner(1, 2))  # 6
```

-   `add_runner` 和 `double_runner` 是 `Runnable` 类的两个实例，分别包装了 `add` 和 `double` 函数。
-   `add_runner | double_runner` 等价于`add_runner.__or__(double_runner)`，返回了一个新的`Runnable`对象。
-   调用`result_runner(1,2)`，实际是调用`chained_func`。在`add_runner | double_runner` 中，`chain_func`里的`self.func`是`add_runner.func`, `other`是`double_runner`。所以第一步调用了`add(1,2)`，然后将结果`3`传给`double_runner`，即`double_runner(3)`。调用`double(3)`，最终得到结果`6`。

可以发现，`Runnable`已经具备基本的管道数据传递的能力了。



### `Runnable`

LangChain 通过重写`__or__`，也实现了自己的`Runnable`。有点不同的是，`Runnable.__or__`返回了`Runnable`的子类`RunnableSequence`。

正确理解`Runnable`和`RunnableSequence`，就能很容易了解 LCEL 链的执行流程了。LCEL 链上的每一个组件，都是一个`Runnable`对象。而 LCEL 链是一个`RunnableSequence`。

```python
from langchain.output_parsers import CommaSeparatedListOutputParser
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAI
from langchain.schema.runnable import Runnable,RunnableSequence

llm = OpenAI()
print(isinstance(llm, Runnable))
# >> True

list_parser = CommaSeparatedListOutputParser()
print(isinstance(list_parser, Runnable))
# >> True

prompt_template = PromptTemplate(
    template="List some {subject}.\n",
    input_variables=["subject"],
)
print(isinstance(prompt_template, Runnable))
# >> True

chain = prompt_template | llm | list_parser
print(isinstance(chain, RunnableSequence))
# >> True
```

`Runnable`定义了`invoke、stream、batch、ainvoke、astream、abatch` 6 个方法，用于实现流处理、批处理、异步等功能。每个组件都继承`Runnable`，并且实现上述 6 个方法。

`RunnableSequence`表示一个由多个 `Runnable` 对象组成的序列。`RunnableSequence` 包含 `first`、`middle` 和 `last` 属性，这些属性都是 `Runnable` 类型的对象，代表序列中的第一个、中间的和最后一个 `Runnable`。`RunnableSequence` 也重写了`invoke`、`stream`、`batch`、`ainvoke`、`astream`、`abatch` 6 个方法，以支持按照序列执行 `Runnable` 对象。

以`RunnableSequence.invoke`为例：

```python
class RunnableSequence(RunnableSerializable[Input, Output]):
    ...
    def invoke(...):
        # step代表链中的每个组件实例
        for i, step in enumerate(self.steps):
            input = step.invoke(input, ...)
```

下面再简单给出`Runnable`和`RunnableSequence`的 UML 图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5331c14ed65249a0864934cfba8db9cb~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1445&h=494&s=95247&e=png&b=f2f2f2" alt=""  /></p>

所以，执行 LCEL 链时，根据调用的方法（invoke/stream/batch），链中的每个组件也依次调用对应的方法，并将输出作为下一个组件的输入，直到最后。

```python
chain = component1|component2|component3
output = chain.invoke(input);
"""
等价于：
output1 = component1.invoke(input)
output2 = component2.invoke(output1)
output = component3.invoke(output2)
"""
```





## LangChain 中那些常见的 Runnables

为了丰富 LCEL 的功能，LangChain 基于`Runnable`开发了一系列工具类，这些类极大降低了构造复杂链的代码复杂性。在本节的最后，我们再介绍几种常见的类。

### RunnablePassthrough

`RunnablePassthrough` 是一个简单的 `Runnable` 包装器，用于在链中简单“透传”数据。`RunnablePassthrough`位于链的第一跳时，代表用户的输入；位于中间环节时，代表上一步骤组件的输出内容。

`RunnablePassthrough`在需要调整下一组件输入的场景下非常有用，比如在 RAG 场景下，我们需要先根据用户输入检索相关数据，将检索的结果与用户原始问题一起往下传递用于构造提示模板。

```python
from langchain.schema.runnable import RunnablePassthrough
...
# 检索器，后面课程详细介绍，这里先只要知道是用于根据用户输入来检索数据即可
retriever = vectorstore.as_retriever()

# 提示模板，需要填充用户输入和检索的数据
template = """Answer the question based only on the following context:
{context}

Question: {question}
"""
prompt_template = ChatPromptTemplate.from_template(template)

retrieval_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt_template
    | OpenAI()
    | StrOutputParser()
)

retrieval_chain.invoke("如何写一本掘金小册？")
```

在上面的`retrieval_chain`中，用户输入的问题会同时传给`retriever`和`RunnablePassthrough()`。`retriever`完成检索后，将结果赋值给`context`。然后，检索结果`context`和用户输入`question`一并传给提示模板`prompt_template`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6153e49e7f9744c2b429c3c6f5270b30~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2552&h=686&s=101468&e=png&b=ffffff)

看上面的代码时，不知道你有没有一个疑问：LCEL 链上的每一个环节都是一个`Runnable`，`{"context": retriever, "question": RunnablePassthrough()}`这个明明是一个 python 字典呀？

注意到上图中的`RunnableParallel`了吗？这是因为隐式地将字典封装成了一个`RunnableParallel`。我们往下学习`RunnableParallel`究竟是什么。



### RunnableParallel

`RunnableParallel`设计用于并行执行多个`Runnable`，即我们可以将多个组件/链通过`RunnableParallel`封装起来，并发执行。通过`RunnableParallel`，我们可以很方便实现部分环节并发或多个链整体并发的需求。

-   多个链并发

当我们需要对多个链执行同一个输入时，可以将这些链通过`RunnableParallel`合成一个新链，调用新链可以并发执行多个子链。

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel
from langchain_openai import ChatOpenAI

llm = ChatOpenAI()
joke_chain = ChatPromptTemplate.from_template("tell me a joke about {topic}") | llm
poem_chain = (
    ChatPromptTemplate.from_template("write a 2-line poem about {topic}") | llm
)

map_chain = RunnableParallel(joke=joke_chain, poem=poem_chain)

map_chain.invoke({"topic": "bear"})
```

```python
{'joke': AIMessage(content="Why don't bears wear shoes?\n\nBecause they have bear feet!"),
 'poem': AIMessage(content="In the wild's embrace, bear roams free,\nStrength and grace, a majestic decree.")}
```

`map_chain`会并发执行`joke_chain`和`poem_chain`，提高执行效率。

-   部分组件并发

有时候用户输入的问题需要在多个数据源检索相关信息，然后再与问题一起传递给提示模板。

这个时候，我们可以将多个检索器封装成一个`RunnableParallel`，并发检索结果后再一起往下传递。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5ce318d783334a53b1cb73f1e6f7cd6e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2474&h=684&s=137608&e=png&b=ffffff" alt=""  /></p>



```python
from langchain.schema.runnable import RunnablePassthrough
...
# 检索器1
retriever1 = vectorstore1.as_retriever()
# 检索器2
retriever1 = vectorstore2.as_retriever()

# 提示模板，需要填充用户输入和检索的数据
template = """Answer the question based only on the following context:
{context1}

{context2}

Question: {question}
"""
prompt_template = ChatPromptTemplate.from_template(template)

multi_retrieval_chain = (
    RunnableParallel({
        "context1": retriever1, 
        "context2": retriever2,
        "question": RunnablePassthrough()
    })
    | prompt_template
    | OpenAI()
    | StrOutputParser()
)

multi_retrieval_chain.invoke("如何写一本掘金小册？")
```

-   隐形转换

在 LCEL 链上，会将字典隐形转换为`RunnableParallel`，也就是说上面的`multi_retrieval_chain`可以简化为如下：

```python
multi_retrieval_chain = (
    {
        "context1": retriever1, 
        "context2": retriever2,
        "question": RunnablePassthrough()
    }
    | prompt_template
    | OpenAI()
    | StrOutputParser()
)
```


### RunnableBranch

`RunnableBranch`主要用于多分支子链的场景，为链的调用提供了路由功能。类似`if/else`，我们可以为`RunnableBranch`创建多个分支，为每个分支指定一个子链。执行时，`RunnableBranch`从上到下依次遍历每个分支，当第一次找到满足条件的分支时，就会使用分支对应的子链。

`RunnableBranch`的使用在上面 “**LCEL 构建复杂 LLM 链**” 小节已经展示过了，这里就不再重复贴代码了，大家可以往上翻一下，看看经过后面 LCEL 的介绍，现在能不能理解这一块的代码了。

  


### RunnableLambda

`RunnableLambda`是 LangChain 实现的一个很强大的`Runnable`类，它允许你将普通的 Python 函数或可调用对象转换为 `Runnable`对象，可以 “享受” 到`Runnable`流处理、批处理、异步化等各种特性。

```python
from langchain_core.runnables import RunnableLambda
def add_one(x: int) -> int:
    return x + 1
# 将函数转换为 Runnable 对象
runnable_add_one = RunnableLambda(add_one)
print(runnable_add_one.invoke(5))  # 得到 6
```

这种转换使得任何函数都可以被用作 LCEL 链的一部分，我们可以通过自定义函数的方式把外部系统集成到 LCEL 链中。比如，我们需要把链中某个环节的输出上报到日志系统，我们可以定义一个函数，该函数接受链中上一个环节的输出，并将其上报到日志系统：

```python
from langchain_core.runnables import RunnableLambda
from langchain_openai import OpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

def report_to_log(llm_answer: str):
    print(f"Reporting {llm_answer} to log system")
    return llm_answer

prompt = PromptTemplate.from_template("answer the question: {question}\n\n answer:")
chain = prompt | OpenAI() | RunnableLambda(report_to_log) | StrOutputParser()
chain.invoke({"question": "whats 2 + 2?"})
```

需要注意的是，被`RunnableLambda`封装的函数，只能有一个输入参数。

  


## 总结

1.  LangChain 存在两种建链方式 —— 传统使用类的方式创建和通过 LCEL 语法创建，LCEL 使用管道符 "|" 来连接不同的组件，提供了更强的组合性，并且提供了流处理、批处理、异步处理等能力，使得 LLM 应用构建更加灵活和简单。

2.  LCEL 依然是 python 的原生语法，通过重写`__or__`方法实现了管道符传递数据的能力。Runnable 和 RunnableSequence 是理解 LCEL 执行流程的关键，每个组件都是 Runnable 对象，而链是 RunnableSequence。
3.  为了进一步简化 LLM 链的构建，基于 Runnable 开发了 RunnablePassthrough、RunnableParallel、RunnableBranch、RunnableLambda 等一系列工具类，熟练掌握这些类，可以大大提升 LLM 应用的开发效率。

欢迎大家在评论区留下自己的想法和理解，我们可以进一步交流学习。