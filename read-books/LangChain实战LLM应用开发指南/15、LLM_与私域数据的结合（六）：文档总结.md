大家好，欢迎继续学习 LangChain 实战课程。

在这个信息爆炸的时代，我们每天都会遭遇海量的文本资料冲击——无论是复杂的论文、法律条文，还是职场上的商业分析报告。从这些繁杂的文档中提炼出关键信息，成为每个人的必备技能，但这往往需要投入大量的时间和劳力。

LLM 的兴起为自动总结长文档开辟了新的可能性。我们可以利用 LLM 优秀的文本理解和生成功能，更高效地进行文档总结。

今天，我们将会结合 LangChain，探讨目前常见的几种 LLM 总结文档的技术细节和各自的优缺点，以便大家在实际使用时能更好地做出选择。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a65163f5370f4379b8675af13866d1ff~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1622&h=564&s=82525&e=png&b=ffffff" alt="image.png"  /></p>

> 在今天的代码演示中，我会以任正非 2018 年的公开演讲 pdf 作为需要总结的文档，pdf 文件内容我已经上传到 github，大家可以在这里[下载](https://github.com/huiwan-code/llm-tutorial/blob/main/%E4%BB%BB%E6%AD%A3%E9%9D%9E2018.pdf)。
> 




## LangChain 中文档总结链代码设计

LangChain 支持`Stuff`、`Refine`和`Map-Reduce`三种总结文档的模式。我们在下面小节中会详细展开介绍这三种模式，在这里我们先了解 LangChain 的代码是如何组织设计并使用的。

首先，LangChain 为这三种不同的总结文档模式都开发了调用链，分别是`StuffDocumentsChain`、`RefineDocumentsChain`和`MapReduceDocumentsChain`。

但是，一般并不直接使用这三个调用链，LangChain 提供了`load_summarize_chain`方法，我们可以通过调用这个方法，指定对应链类型，创建对应总结模式的调用链。

```python
def load_summarize_chain(
    llm: BaseLanguageModel,
    chain_type: str = "stuff",
    verbose: Optional[bool] = None,
    **kwargs: Any,
) -> BaseCombineDocumentsChain:
    loader_mapping: Mapping[str, LoadingCallable] = {
        "stuff": _load_stuff_chain,
        "map_reduce": _load_map_reduce_chain,
        "refine": _load_refine_chain,
    }
    ...
    return loader_mapping[chain_type](llm, verbose=verbose, **kwargs)
```
可以看到，根据传入`chain_type`的不同，最终会调用`loader_mapping`中不同的`_load_xxx_chain`方法初始化调用链。

之所以要这样，是为了方便具体调用链的初始化，以`_load_stuff_chain`举例说明：

```python
def _load_stuff_chain(
    llm: BaseLanguageModel,
    prompt: BasePromptTemplate = stuff_prompt.PROMPT,
    document_variable_name: str = "text",
    verbose: Optional[bool] = None,
    **kwargs: Any,
) -> StuffDocumentsChain:
    llm_chain = LLMChain(llm=llm, prompt=prompt, verbose=verbose)
    return StuffDocumentsChain(
        llm_chain=llm_chain,
        document_variable_name=document_variable_name,
        verbose=verbose,  # type: ignore[arg-type]
        **kwargs,
    )
```

由于`StuffDocumentsChain`被设计成接收`LLMChain`，所以在`_load_stuff_chain`中，会根据传入的`llm`和`prompt`，生成`LLMChain`，用于后续的初始化。

下面，我们开始介绍 LLM 总结文档的不同做法。



## Stuff 一次性总结

这是最简单也是最直观的一种总结方式，即将整个文档作为上下文传给 LLM 处理。

LangChain 中，`StuffDocumentsChain`会默认使用以下 prompt 对文档进行总结：
```python
"""
Write a concise summary of the following:


"{text}"


CONCISE SUMMARY:
"""
# 翻译后：
"""
写出以下内容的简洁摘要:

"{text}"

简洁总结:
"""
```

可以看到，`Stuff`这种模式简单粗暴，对于一些较短的文档，比如单个网页内容、篇幅较短的论文，我们直接使用这种方式即可。下面看看其总结效果：

```python
from langchain.chains.summarize import load_summarize_chain
from langchain_core.prompts import PromptTemplate
from langchain_community.document_loaders import PyPDFLoader
# 按页加载文档
loader = PyPDFLoader("任正非2018.pdf")
docs = loader.load()
prompt_template = """Write a concise summary of the following:


"{text}"

ANSWER IN THE TEXT ORIGINAL LANGUAGE!
CONCISE SUMMARY:"""

prompt = PromptTemplate(template=prompt_template, input_variables=["text"])

stuff_chain = load_summarize_chain(llm = ChatOpenAI(), chain_type="stuff", prompt = prompt)
# 总结第一页内容
print(stuff_chain.invoke(docs[:1])["output_text"])
```

```shell
在2018年的全球行政年会上，华为公司董事长任正非对公司的行政变革和后勤保障团队表示感谢，并提出了一系列改革和优化的建议。他强调了行政服务的重要性，并提出要建立一个基于信任的管理体系。任正非还强调了华为公司在全球各地提供服务的使命，并呼吁员工要有自我保障意识。
```

估计是选择的模型问题，使用 LangChain 默认提供的提示词时，我发现虽然文档是中文内容，但 LLM 还是会以英文回复。所以，我加强了下提示词（ANSWER IN THE TEXT ORIGINAL LANGUAGE!），限制 LLM 要使用文档对应的语言进行回复。“模型不够，提示来凑”。

从输出的总结结果来看，LLM 总结的点还算全面，但由于 LLM token 数量的限制，我一次总结两页 pdf 的时候就已经报错了。

```shell
openai.BadRequestError: Error code: 400 - {'error': {'message': "This model's maximum context length is 4097 tokens. However, your messages resulted in 6530 tokens. Please reduce the length of the messages.", 'type': 'invalid_request_error', 'param': 'messages', 'code': 'context_length_exceeded'}}
```

而这也是`Stuff`这种总结模式的一大缺陷 —— 只能用于短文档，当然，随着长上下文窗口限制的不断突破，这个“短”也会不断被拉长。

但是，即使 LLM 支持超长的上下文窗口，使用`Stuff`去对大文档进行总结还需要考虑另外一个问题。

还记得上节课介绍`LongContextReorder`时提到的 [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) 论文吗？该论文表示模型无法有效捕获和处理位于文档中间位置的信息。

所以，当输入的文档太长时，LLM 可能会丢失某些中间关键信息，导致生成的摘要中缺少上下文信息和连贯性。



## Refine 迭代总结

`Refine`是更复杂的文档总结技术，旨在解决上述提到的`Stuff`总结大文档时的局限性。

其具体思路是：先将大文档拆分成多个小文档块，然后先对第一个文档块进行总结，生成摘要，再将生成的摘要与下一个文档块一起传给 LLM，完善摘要信息，以此类推，直到全部文档块都参与摘要生成为止。

整体工作流程及过程中 LangChian 默认使用的提示词如下图：


<p align=center><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7766cf790ec6446f893c367146e23494~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2638&h=970&s=286717&e=png&b=fdfdfd" alt="image.png"  /></p>


我们先看看`Refine`的总结效果，这次，我们一次性总结 10 页 pdf。

```python
from langchain.chains.summarize import load_summarize_chain
from langchain_community.document_loaders import PyPDFLoader
# 按页加载文档
loader = PyPDFLoader("任正非2018.pdf")
docs = loader.load()

refine_chain = load_summarize_chain(llm = ChatOpenAI(model_name="gpt-3.5-turbo-1106"), input_key="input_documents", chain_type="refine")
print(refine_chain({"input_documents": docs[:10]}, return_only_outputs=True))
```
```shell
在2018年全球行政年终会议上，任正非强调了行政变革所取得...以及在基础研究和教育方面的重要举措。
```

`Refine`通过将文档拆分的方式，虽然避免了 LLM 一次性处理长文本的问题，但是实际测试下来，其总结长文本的效果不一定理想，因为最终摘要依赖前面文档生成的摘要，如果在某个迭代中，中间摘要生成效果不佳，可能会直接影响最终摘要。

比如，我在使用 LangChain 默认提供的提示词时，有时候会生成 “根据提供的新信息，原始摘要中的现有内容仍然有效。因此，我们将保留原始摘要。” 的乌龙摘要。

所以，如果在实际业务中使用`Refine`这种文档总结模式，需要根据业务场景使用的文档类型去微调 refine_prompt。

此外，`Refine`方式耗时极长，因为需要多次调用 LLM，而且是串行处理多个子文档。



## Map-Reduce 分而治之

`Map-Reduce`是目前使用更广泛的一种 LLM 文档总结技术。与`Refine`一样，会先将大文档拆分为多个小文档，然后，每个小文档都会**并发**传给 LLM，为每个子文档生成简明摘要。最后，再将这些摘要合并一起传给 LLM，生成全面的文档摘要。

<p align=center><img src="https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6a6351f5560042d3a1bff0ad67154515~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2212&h=1142&s=194717&e=png&b=fdfdfd" alt="image.png"  /></p>

从上面流程图中可以看到，默认情况下，LangChain 使用相同的提示词用于生成子文档摘要和汇总最终的结果摘要。

```python
from langchain.chains.summarize import load_summarize_chain
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("任正非2018.pdf")
docs = loader.load()

map_reduce_chain = load_summarize_chain(llm = ChatOpenAI(model_name="gpt-3.5-turbo-1106"), input_key="input_documents", chain_type="map_reduce")
print(map_reduce_chain({"input_documents": docs[:10]}, return_only_outputs=True))
```
```shell
{'output_text': '在2018年全球行政年会上，任正非感谢华为公司后勤保障队伍的努力，并指出公司正在进行一系列变革，包括优化行政管理体系，简化行政服务，建立基于信任的管理体系，并逐步改善全球各地区的工作和生活环境。他强调了对人才的需求和公司发展战略的思考，以及加强与国内大学的合作，共同推动基础研究的重要性。'}
```

总结相同的 10 个 pdf，`Map-Reduce`耗时会明显比`Refine`低很多，并行处理多个子文档极大提高了效率。

`Map-Reduce`方法的效果很大程度上取决于文档拆分的合理性。如果拆分不当，导致信息被割裂，即使在 “reduce” 步骤中进行整合，也很难形成一个高质量、连贯的总结。

因此，在采用 `Map-Reduce` 方法时，需要格外注意文档拆分的合理性，确保每个文档块都包含相对独立和完整的信息，从而确保最终摘要的质量。



## 总结

今天，我们主要介绍了`Stuff`、`Refine`和`Map-Reduce`三种使用 LLM 进行文档总结的方法。

总的来说，`Stuff`简单方便，比较适合短文档的摘要提取；`Refine` 方法则更适合处理动态变化的文档，需要不断完善总结结果的场景。而`Map-Reduce` 方法更适合处理大量独立文档的批量总结。

这三种方法各有优缺点，需要根据具体需求选择合适的方式。

文档总结是 LLM 的一大使用场景，文档总结的方法有很多，远不止今天介绍的三种。

比如，无论是`Refine`和`Map-Reduce`，它们很明显的一个问题是需要频繁调用 LLM，费时费钱。于是，有人在 [Twitter](https://twitter.com/GregKamradt/status/1653060004226924544) 上讨论出了一种基于 K-Means 聚合分类的文档总结方法，并且已经有了相应的[代码实现](https://github.com/gkamradt/langchain-tutorials/blob/main/data_generation/5%20Levels%20Of%20Summarization%20-%20Novice%20To%20Expert.ipynb)。

其大概思路是：先将文档拆分成较小文档并进行嵌入向量化，之后，利用 K-Means 聚类算法对这些向量进行分类，相似的向量会聚在一起形成一个簇，最后，找到每个簇中的代表向量（接近簇中心），对这些向量进行总结，得到最后的摘要。

这种方法通过挑选最具代表性的子文档块，并将这些代表块一次性调用 LLM 进行总结，理论上可以生成内容相对全面的摘要，也能避免 LLM 的多次调用。