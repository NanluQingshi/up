大家好，欢迎继续学习 LangChain 实战课程。

上节课我们介绍了几种常见的提示技巧，这些技巧对于构建强大稳定的 LLM 应用有着重要的作用。在今天的教程中，我们将进一步探讨如何将这些提示技巧与 LangChain 框架结合起来，高效构建 prompt。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9ab97a39c5d24aed802f19fd816cbac0~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2688&h=1116&s=243332&e=png&b=ffffff" alt=""  /></p>



## 什么是提示模板

LangChain 中通过提示模板来构建最终的 prompt。`提示模板`是 LangChain 的核心功能之一，我们先通过一个例子来说明提示模板的好处。

假设我们要开发一个 AI 翻译应用。支持将中文翻译成英语，使用的 prompt 如下：

```
你是一个专业的翻译助手。请将下面<data>标签中的中文翻译成英文，你只需要回答翻译结果。 
<data>{input}</data>
```

后面，我们发现还有将中文翻译成德语的需求，又生成一个新的 prompt：

```
你是一个专业的翻译助手。请将下面<data>标签中的中文翻译成德文，你只需要回答翻译结果。 
<data>{input}</data>
```

可以发现，这种生成 prompt 的方法很 “蠢”，每增加一种新的翻译需求，我们就得多维护一个 prompt。既然大部分内容是一样的，那我们可以**将其`模板化`，动态适配多种需求场景**。

模板代码如下：

```python
def GenPrompt(from_lang, to_lang, text):     
    return """
    你是一个专业的翻译助手。请将下面<data>标签中的{}翻译成{}，你只需要回答翻译结果。     
    <data>{}</data>
    """.format(from_lang, to_lang, text)
```

现在，我们只需要维护这份模板代码即可，通过实时运行时传入不同的变量，就能得到满足多种场景的提示词，极大提高了 prompt 开发的效率。

同时，模板化设计还确保了 prompt 的规范性和一致性。比如，我们需要模型以特定的格式返回，只需要调整`GenPrompt`函数里的字符串部分，就可以保证相关场景的输出格式都能符合预期标准。

由于 Chat Model 和 LLM Model 接收的 prompt 类型不同：**LLM Model 接收的是字符串；Chat Model 接收的是 message**。LangChain 分别提供了不同类型的提示模板。




## LLM Model 使用提示模板

### `PromptTemplate`构建字符串提示模板

在 LLM Model 中，我们可以使用`PromptTemplate`构造字符串提示模板。基本用法如下：

```python
from langchain.prompts.prompt import PromptTemplate 
promptTemplate = PromptTemplate(input_variables=["city"], template="简单介绍下{city}这座城市的特色") 
promptTemplate.format(city="广州") 
# >> 简单介绍下广州这座城市的特色
```

`input_variables`用于指定 `template`字符串中的变量名，在方法`format`中传入变量值，生成最终的 prompt。

如果不想手动指定`input_variables`，可以使用`PromptTemplate.from_template`方法创建`PromptTemplate`，LangChain 将自动推断出`input_variables`。

```python
from langchain.prompts.prompt import PromptTemplate 
promptTemplate = PromptTemplate.from_template("简单介绍下{city}这座城市的特色") promptTemplate.format(city="广州") 
# >> 简单介绍下广州这座城市的特色
```



### `FewShotPromptTemplate`构建少样本字符串提示模板

少样本提示是一种非常重要的提示技巧，它允许模型在不进行额外训练或微调的情况下，仅通过观察几个示例就能学习并适应新任务。这可以有效避免过度依赖大量标注数据，降低资源消耗，快速适应多种不同应用场景。

LangChain 分别为 LLM Model 和 Chat Model 提供了`FewShotPromptTemplate`和`FewShotChatMessagePromptTemplate`，专门用于生成少样本提示模板。

我们先看看`FewShotPromptTemplate`如何使用。



**第一步，准备示例集。**

我们先以 k-v 格式提供一些示例样本，示例如下：

```python
examples = [
    {
        "question": "从一副标准扑克牌中随机抽取一张牌，计算抽到红桃的概率。",
        "answer": "概率为 1/4。"
    },
    {
        "question": "在一组人中，60%是女性。如果随机选择一个人，计算她是女性并且是左撇子的概率，已知左撇子的概率为 10%。",
        "answer": "概率为 6%。"
    },
    {
        "question": "一枚硬币被抛两次，计算至少一次出现正面的概率。",
        "answer": "概率为 3/4。"
    },
    {
        "question": "在一批产品中，90%是正常的，10%有缺陷。如果一个产品有缺陷，被检测到的概率是95%。计算一个被检测为有缺陷的产品实际上是有缺陷的概率。",
        "answer": "概率为 32/143。"
    },
    {
        "question": "一个骰子被掷 3 次，计算得到至少一次 6 的概率。",
        "answer": "概率为 91/216。"
    },
    {
        "question": "在 0 到 1 的区间内均匀分布的随机变量 X，计算 X 小于 0.3 的概率。",
        "answer": "概率为 0.3。"
    },
    {
        "question": "一枚硬币被抛 5 次，计算正面朝上的次数为 3 的概率。",
        "answer": "概率为 10/32。"
    },
    {
        "question": "考试成绩近似服从正态分布，平均分为 70 分，标准差为 10 分。计算得分高于 80 分的学生的概率。",
        "answer": "概率为约 15.87%。"
    }
]
```

**第二步，格式化示例集。**

接下来，我们需要利用`PromptTemplate`创建一个格式化器，将上面例子转换成预期的字符串形式。

```python
from langchain.prompts import PromptTemplate 
example_prompt = PromptTemplate(input_variables=["question","answer"], template="Question: {question}\n{answer}") 
example_prompt.format(**examples[0]) 
# >> Question: 从一副标准扑克牌中随机抽取一张牌，计算抽到红桃的概率。 
# >> 概率为 1/4。
```

**第三步，创建** **`FewShotPromptTemplate`** **对象。**

最后，我们将例子集和格式化器作为输入，创建一个`FewShotPromptTemplate` 对象。

```python
from langchain.prompts.few_shot import FewShotPromptTemplate
few_shot_prompt_template = FewShotPromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
    prefix="You are an assistant good at {field}, learn the below examples and then answer the last question",
    suffix="Question: {question}",
    input_variables=["field","question"]
)
```

在使用`few_shot_prompt_template`构造 prompt 时，先使用`example_prompt`将`examples`格式化为字符串，默认情况下示例之间使用换行符（\n\n）隔开，我们暂时先将这部分格式化后的字符串称为 `formatted_examples_str`。

`prefix`和`suffix`分别表示拼接在`formatted_examples_str`前面和后面的模板内容，接收 `input_variables` 里的变量，生成具体的字符串。

也就是说，最终的 prompt = `prefix` + `formatted_examples_str` + `suffix`，各部分之间默认使用换行符（\n\n）隔开。

```python
few_shot_prompt_template.format(field="math", question="一个标准六面骰子被投掷一次，计算出现奇数的概率。")
"""
You are an assistant good at math, learn the below examples and then answer the last question

Question: 从一副标准扑克牌中随机抽取一张牌，计算抽到红桃的概率。
概率为 1/4。

Question: 在一组人中，60%是女性。如果随机选择一个人，计算她是女性并且是左撇子的概率，已知左撇子的概率为 10%。
概率为 6%。

Question: 一枚硬币被抛两次，计算至少一次出现正面的概率。
概率为 3/4。

Question: 在一批产品中，90%是正常的，10%有缺陷。如果一个产品有缺陷，被检测到的概率是95%。计算一个被检测为有缺陷的产品实际上是有缺陷的概率。
概率为 32/143。

Question: 一个骰子被掷 3 次，计算得到至少一次 6 的概率。
概率为 91/216。

Question: 在 0 到 1 的区间内均匀分布的随机变量 X，计算 X 小于 0.3 的概率。
概率为 0.3。

Question: 一枚硬币被抛 5 次，计算正面朝上的次数为 3 的概率。
概率为 10/32。

Question: 考试成绩近似服从正态分布，平均分为 70 分，标准差为 10 分。计算得分高于 80 分的学生的概率。
概率为约 15.87%。

Question: 一个标准六面骰子被投掷一次，计算出现奇数的概率。
"""
```



### `ExampleSelector`实现动态样本提示

由于模型对单次的 token 数量有限制，如果有示例集很大，将全量提示集加入最终的 prompt 中，可能会导致 token 数量溢出。同时，如果将一些与问题相关性较低的示例加入到 prompt 中，也会影响模型的回复质量。

所以，更好的做法是根据提出的问题筛选出最相关的若干示例样本加到 prompt 中。LangChain 提供了`ExampleSelector` 来实现这个效果。

`ExampleSelector`的接口定义很简单：

```python
class BaseExampleSelector(ABC):
    """Interface for selecting examples to include in prompts."""

    @abstractmethod
    def add_example(self, example: Dict[str, str]) -> Any:
        """Add new example to store."""

    @abstractmethod
    def select_examples(self, input_variables: Dict[str, str]) -> List[dict]:
        """Select which examples to use based on the inputs."""
```

`add_example`用于往示例集中添加示例；`select_examples`则根据输入的`input_variables`变量，返回示例列表，返回哪些示例取决于每个`select_examples`具体的实现。

LangChain 已经实现了几种常见的`ExampleSelector`，各选择器的简介如下：

| 选择器名称                               | 选择示例的逻辑                       |
| ----------------------------------- | ----------------------------- |
| LengthBasedExampleSelector          | 根据指定的 prompt 最大长度，选择尽可能多的示例    |
| MaxMarginalRelevanceExampleSelector | 根据输入和示例之间的最大边际相关性来决定选择哪些示例   |
| NGramOverlapExampleSelector         | 根据输入和示例之间的 ngram 距离来决定选择哪些示例 |
| SemanticSimilarityExampleSelector   | 根据输入和示例之间的语义相似性来决定选择哪些示例     |


我们以`LengthBasedExampleSelector`为例，具体学习下一个 `ExampleSelector` 该如何实现。

`LengthBasedExampleSelector`的实现代码如下：

```python
class LengthBasedExampleSelector(BaseExampleSelector, BaseModel):
    # 存储示例集
    examples: List[dict]

    # 示例格式化模板
    example_prompt: PromptTemplate

    # 统计字符串长度的函数，默认是_get_length_based
    get_text_length: Callable[[str], int] = _get_length_based

    # prompt 最大长度限制，默认是 2048
    max_length: int = 2048

    # 记录各示例的长度
    example_text_lengths: List[int] = []

    def add_example(self, example: Dict[str, str]) -> None:
        # 原始 k-v 示例存放进examples列表
        self.examples.append(example)
        # 使用example_prompt模板格式化成字符串
        string_example = self.example_prompt.format(**example)
        # 使用get_text_length计算格式化后示例字符串的长度，并将长度记录进example_text_lengths列表中
        self.example_text_lengths.append(self.get_text_length(string_example))
    ...
    def select_examples(self, input_variables: Dict[str, str]) -> List[dict]:
        # input_variables.values()表示模板的变量具体内容，所以inputs 代表用户全部输入
        inputs = " ".join(input_variables.values())
        # 计算除去用户输入后，还剩多少长度可用于添加示例
        remaining_length = self.max_length - self.get_text_length(inputs)
        i = 0
        examples = []
        # 遍历示例集，在不超过remaining_length的前提下，尽可能多的返回示例
        while remaining_length > 0 and i < len(self.examples):
            new_length = remaining_length - self.example_text_lengths[i]
            if new_length < 0:
                break
            else:
                examples.append(self.examples[i])
                remaining_length = new_length
            i += 1
        return examples
```

已经做了详细的代码注释，大家可以仔细学习下。值得一提的是，计算长度时，默认使用的是`_get_length_based`函数。下面是这个函数的实现：

```python
def _get_length_based(text: str) -> int:
    return len(re.split("\n| ", text))
```

所以，默认情况下，是以换行符和空格进行长度统计。如果有自定义的需求，比如使用 token 计算长度，可以实现自己的长度计算函数，然后传入`get_text_length`即可。



接下来，我们重构上面的少样本提示模板，看看如何使用`LengthBasedExampleSelector`创建一个动态版的少样本提示模板。

首先，创建一个`LengthBasedExampleSelector`对象。

```python
from langchain.prompts.example_selector import LengthBasedExampleSelector
def get_len_by_char(text: str):
    return len(text)

example_selector = LengthBasedExampleSelector(
    # 全量的示例集
    examples=examples,
    # 指定格式化示例的模板
    example_prompt=example_prompt,
    # 指定最大长度为100，使用get_len_by_char函数，按字符去计算长度，即用户输入+示例最多只允许100个字符
    max_length=100,
    get_text_length=get_len_by_char
)
```

然后，在实例化`FewShotPromptTemplate`对象时，不再是传入全量的示例集，而是传入上面的示例选择器对象。

```python
dynamic_few_shot_prompt_template = FewShotPromptTemplate(
    example_selector=example_selector,
    example_prompt=example_prompt,
    prefix="You are an assistant good at {field}, learn the below examples and then answer the last question",
    suffix="Question: {question}",
    input_variables=["field","question"]
)
```

现在，我们看看新的提示模板的效果。

```python
dynamic_few_shot_prompt_template.format(field="math", question="一个标准六面骰子被投掷一次，计算出现奇数的概率。")
"""
You are an assistant good at math, learn the below examples and then answer the last question

Question: 从一副标准扑克牌中随机抽取一张牌，计算抽到红桃的概率。
概率为 1/4。

Question: 一个标准六面骰子被投掷一次，计算出现奇数的概率。
"""
```

与之前的提示模板相比，由于最大长度的限制，只添加了一个示例到最终的 prompt 中。




## Chat Model 使用提示模板

### `ChatPromptTemplate` 构建消息提示模板

Chat Model 与 LLM Model 不同，Chat Model 处理的是`消息类型（message）`的数据，每条消息包含**角色（role）和消息内容（content）** 两部分。消息角色已经在[《LangChain 安装与快速入门》](https://juejin.cn/book/7352849785881591823/section/7351455523616915468)有详细介绍，在这里不再过多赘述。

LangChain 设计了`ChatPromptTemplate`，用于构造复杂的对话提示。以下是一个使用`ChatPromptTemplate`的例子：

```python
from langchain.prompts import ChatPromptTemplate,HumanMessagePromptTemplate,SystemMessagePromptTemplate
from langchain_core.messages import SystemMessage,HumanMessage
from langchain_openai import ChatOpenAI

chat_template = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template("你是一个专业的翻译助手，擅长将{source_lang}翻译成{dest_lang}, 对输入的文本进行翻译"),
        HumanMessagePromptTemplate.from_template("{text}")
    ]
)

final_prompt = chat_template.format(source_lang="中文", dest_lang="英语",text="快乐编程")
# > System: 你是一个专业的翻译助手，擅长将中文翻译成英语, 对输入的文本进行翻译
# > Human: 快乐编程
...
# 配置 OPENAI_API_KEY 和 OPENAI_API_BASE
...
llm = ChatOpenAI()
llm(final_prompt)
# > IAMessage(content="Happy coding")
```

`ChatPromptTemplate.from_messages` 可接收多条消息组成消息列表。

每类消息都有各自的提示模板类（`HumanMessagePromptTemplate`、`SystemMessagePromptTemplate`、`AIMessagePromptTemplate`），可以通过`from_template`方法创建一个带有变量占位符（"{}"）的消息模板字符串。

`ChatPromptTemplate.from_messages` 接收多个消息模板字符串，组成完整的消息提示模板，并在`ChatPromptTemplate.format` 中填充变量内容，得到最终的 prompt。

Chat Model 返回的是一个 ai 消息，在 LangChain 中以`IAMessage`数据结构表示。





### `FewShotChatMessagePromptTemplate` 构建少样本消息提示模板

同样的，LangChain 也提供了`FewShotChatMessagePromptTemplate`用于创建 Chat Model 的少样本提示模板。这在我们需要模型快速适应新任务时非常有用。

```python
from langchain_core.messages import SystemMessage
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate,SystemMessagePromptTemplate, AIMessagePromptTemplate,FewShotChatMessagePromptTemplate
# 准备示例集
examples = [
    {"input": "2+2", "output": "4"},
    {"input": "2+3", "output": "5"},
]

# 创建ChatPromptTemplate对象，用于对examples进行模板格式化
example_prompt = ChatPromptTemplate.from_messages(
    [
        HumanMessagePromptTemplate.from_template("{input}"),
        AIMessagePromptTemplate.from_template("{output}")
    ]
)

# 创建FewShotChatMessagePromptTemplate实例
few_shot_prompt = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples
)
print(few_shot_prompt.format())
# > Human: 2+2
# > AI: 4
# > Human: 2+3
# > AI: 5

# 最终的提示模板仍然是一个ChatPromptTemplate对象，创建时传入上面的few_shot_prompt
final_prompt_template = ChatPromptTemplate.from_messages(
    [
        SystemMessage(content="You are a wondrous wizard of math."),
        few_shot_prompt,
        ("human", "{input}")
    ]
)
print(final_prompt_template.format(input="1+1"))
# > System: You are a wondrous wizard of math.
# > Human: 2+2
# > AI: 4
# > Human: 2+3
# > AI: 5
# Human: 1+1
```

与 LLM Model 的 `FewShotPromptTemplate`不同，`FewShotChatMessagePromptTemplate` 只是用于格式化示例集，生成一个消息列表。最终的消息模板是一个携带示例消息列表的`ChatPromptTemplate`对象。




## 模板复用

LangChain 提供了多种方式来复用和组合模板，以适应不同的应用场景。


### composition 拼接

我们可以通过简单的字符串拼接（"+"）来组合不同的模板。甚至可以拼接字符串和提示模板对象，但需要注意拼接时第一个元素必须是模板对象，而且如果是拼接消息模板，字符串会被自动推断为 `HumanMessagePromptTemplate`。

```python
from langchain.prompts import PromptTemplate
prompt = (
    PromptTemplate.from_template("Tell me a joke about {topic}")
    + ", make it funny"
    + "\n\nand in {language}"
)
prompt.format(topic="sports", language="english")
# > Tell me a joke about sports, make it funny\n\nand in english

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
# 字符串"{input}"被自动推断成HumanMessagePromptTemplate。
chat_prompt = (
SystemMessage(content="You are a nice assistant") +
HumanMessage(content="hi") + AIMessage(content="what?") + "{input}"
)
chat_prompt.format(input="how are you?")
"""
System: You are a nice assistant
Human: hi
AI: what?
Human: how are you?
"""
```

### pipeline 管道

相比拼接，LangChain 还提供了一种更高级的模板复用方式 —— `pipeline`，**先定义一个 prompt 模板框架，然后再慢慢填充各部分的内容**。

我们来看看官网的一个例子。

首先，定义好最终的 prompt 模板整体框架。

```python
from langchain.prompts.prompt import PromptTemplate
full_template = """{introduction}
{example}
{start}"""
full_prompt = PromptTemplate.from_template(full_template)
```

最终的模板有`introduction`、`example`、`start`三部分，每部分本身也都是一个模板。

```python
# introduction
introduction_template = """You are impersonating {person}."""
introduction_prompt = PromptTemplate.from_template(introduction_template)

# example
example_template = """Here's an example of an interaction:
Q: {example_q}
A: {example_a}"""
example_prompt = PromptTemplate.from_template(example_template)

# start
start_template = """Now, do this for real!
Q: {input}
A:"""
start_prompt = PromptTemplate.from_template(start_template)
```

现在，我们可以将三个子模板填充到`full_prompt`中。

```python
input_prompts = [
    ("introduction", introduction_prompt),
    ("example", example_prompt),
    ("start", start_prompt),
]
pipeline_prompt = PipelinePromptTemplate(
    final_prompt=full_prompt, pipeline_prompts=input_prompts
)
```

`pipeline_prompt`拥有三个子模板的全部变量，即：

```python
pipeline_prompt.input_variables
# > ['example_q', 'example_a', 'input', 'person']
```

所以，在构建生成最终的 prompt 时，需要填入全部变量：

```python
pipeline_prompt.format(
        person="Elon Musk",
        example_q="What's your favorite car?",
        example_a="Tesla",
        input="What's your favorite social media site?",
)
"""
You are impersonating Elon Musk.
Here's an example of an interaction:
Q: What's your favorite car?
A: Tesla
Now, do this for real!
Q: What's your favorite social media site?
A:
"""
```

composition 和 pipeline 可以简单类比过程式编程和声明式编程。使用 composition 时，我们需要明确地将不同的提示片段或模板按顺序拼接起来；而 pipeline，更关注的是 prompt 模板都有哪些部分，然后再慢慢填充每个部分的逻辑。



### LangChainHub 加载模板

[LangChainHub](https://smith.langchain.com/hub) 上托管了大量高质量的提示模板，我们可以在这里保存、加载和共享模板。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9d3c09f63453441c89a5f74bc9edec55~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2728&h=1406&s=422761&e=png&b=ffffff" alt=""  /></p>

使用 LangChainHub 上面的模板，我们需要先安装 `langchainhub` 依赖库。

```
pip install langchainhub
# pdm add langchainhub
```

现在，我们尝试获取下面这个[提示模板](https://smith.langchain.com/hub/pptt1212/assessing-correctness)。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9ba43cf858a04f739a83cfa31dea9ca8~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2632&h=1358&s=393922&e=png&b=ffffff" alt=""  /></p>

```python
from langchain import hub 
prompt_template = hub.pull("pptt1212/assessing-correctness")
```

`hub.pull`返回一个`PromptTemplate/ChatPromptTemplate`对象，我们先看看这个提示模板的模板字符串可通过`template`方法获取：

```
prompt_template.template
"""
让我们深呼吸，并一步一步通过问题和参考答案对学生答案进行批阅工作。

首先学生在参考答案基础上补充新知识点，不作为判断依据。
如果学生答案提供的细节和参考答案类似，请回复"正确"
学生答案不必完全和参考答案匹配，如果学生答案缺少一些细节可以宽容一些，仍然回复"正确"。
请确保没有明显的错误，相反则回复"错误"，并给出"错误解释"。

   问题：{q}\n
    参考答案：{a}\n
    -------
    以下是学生答案：{sa}
    ------

- 你会谨慎参考其他老师对两个答案的建议，当两个答案综合评分差值>={n}且判断和你相反时，要慎重批阅:
------
{r}
------


回复：<正确或错误>\n
错误解释：<当回复错误时，这里指出错误>\n
"""
```




## 总结

1.  提示模板是 LangChain 框架的核心功能，通过模板化，提高了 prompt 开发的效率，确保 prompt 的规范性和一致性。
2.  LLM Model 和 Chat Model 接收的 prompt 类型不同，LangChain 分别提供了`PromptTemplate/ChatPromptTemplate` 来构建提示模板。
3.  少样本提示可以实现模型在不增加额外成本的情况下快速适应新任务，LangChain 分别提供了`FewShotPromptTemplate`和`FewShotChatMessagePromptTemplate`用于构建 LLM Model 和 Chat Model 的少样本提示模板。
4.  `ExampleSelector`可以根据输入选择最相关的示例样本，以优化 prompt 的质量。
5.  LangChain 提供了 composition 和 pipeline 两种模板复用方式，满足不同的组合场景。此外，LangChainHub 托管了大量高质量的提示模板可供我们获取使用。
